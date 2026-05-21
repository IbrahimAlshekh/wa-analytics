package tracker

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"go.mau.fi/whatsmeow/proto/waWeb"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/analytics"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

func (t *Tracker) onHistorySync(evt *events.HistorySync) {
	if evt.Data == nil {
		return
	}
	convs := evt.Data.GetConversations()
	slog.Info("tracker: history sync received",
		"accountID", t.accountID,
		"syncType", evt.Data.GetSyncType().String(),
		"conversations", len(convs),
	)

	inserted := 0
	storiesInserted := 0
	for _, conv := range convs {
		jidStr := conv.GetID()
		if jidStr == types.StatusBroadcastJID.String() {
			slog.Info("tracker: history sync contains status@broadcast conversation",
				"accountID", t.accountID, "messages", len(conv.GetMessages()))
		}
		for _, histMsg := range conv.GetMessages() {
			webMsg := histMsg.GetMessage()
			if webMsg == nil {
				continue
			}
			if t.processHistoryMessage(webMsg) {
				inserted++
			} else if t.processHistoryStory(webMsg) {
				storiesInserted++
			}
		}
	}

	if inserted > 0 {
		slog.Info("tracker: history sync stored new messages", "accountID", t.accountID, "count", inserted)
		t.hub.Broadcast("history_sync", map[string]any{"accountId": t.accountID})
	}
	if storiesInserted > 0 {
		slog.Info("tracker: history sync stored stories", "accountID", t.accountID, "count", storiesInserted)
	}
}

func (t *Tracker) processHistoryMessage(webMsg *waWeb.WebMessageInfo) bool {
	key := webMsg.GetKey()
	if key == nil {
		return false
	}

	msgID := key.GetID()
	if msgID == "" {
		return false
	}

	chatJIDStr := key.GetRemoteJID()
	if chatJIDStr == "" {
		return false
	}

	chatJID, err := types.ParseJID(chatJIDStr)
	if err != nil {
		return false
	}
	chatJID = chatJID.ToNonAD()
	chatStr := chatJID.String()

	// status@broadcast is handled by processHistoryStory, not here.
	// Use field comparison — struct equality fails when JID.Integrator != 0.
	if chatJID.Server == types.BroadcastServer && chatJID.User == types.StatusBroadcastJID.User {
		return false
	}

	ts := int64(webMsg.GetMessageTimestamp())
	if ts == 0 {
		return false
	}

	isFromMe := key.GetFromMe()

	// Determine sender JID.
	var senderJID types.JID
	if participant := key.GetParticipant(); participant != "" {
		// Group message: participant is the actual sender.
		senderJID, _ = types.ParseJID(participant)
		senderJID = senderJID.ToNonAD()
	} else {
		// 1-to-1: sender is the chat peer (or us for outgoing).
		senderJID = chatJID
	}
	senderStr := senderJID.String()

	msg := webMsg.GetMessage()

	// Skip protocol messages (delete, edit, ephemeral) and reactions — they are
	// not regular chat messages and have no place in the messages table.
	if msg.GetProtocolMessage() != nil || msg.GetReactionMessage() != nil {
		return false
	}

	text := extractText(msg)
	mediaType := extractMediaType(msg)

	// Resolve contact — no media download for history sync.
	var contactID *int64
	lookupContact := func(jidStr string, jid types.JID) {
		if contactID != nil {
			return
		}
		var c db.Contact
		var e error
		if jid.Server == types.HiddenUserServer {
			c, e = t.db.GetContactByLID(t.ctx, t.accountID, jidStr)
		} else {
			c, e = t.db.GetContactByJID(t.ctx, t.accountID, jidStr)
		}
		if e == nil {
			contactID = &c.ID
		}
	}

	lookupContact(senderStr, senderJID)
	if !isFromMe {
		lookupContact(chatStr, chatJID)
	}

	m := db.Message{
		AccountID:       t.accountID,
		ContactID:       contactID,
		ChatJID:         chatStr,
		MessageID:       msgID,
		SenderJID:       senderStr,
		IsFromMe:        isFromMe,
		Timestamp:       ts,
		Text:            text,
		MediaType:       mediaType,
		ReceivedAt:      time.Now().Unix(),
		QuotedMessageID: extractQuotedMessageID(msg),
	}

	f := analytics.ExtractFeatures(m.Text, time.Unix(ts, 0))
	saved, err := t.db.InsertMessageWithAnalytics(t.ctx, m, f)
	if err != nil {
		slog.Error("tracker: history sync: insert failed", "accountID", t.accountID, "msgID", msgID, "err", err)
		return false
	}
	return saved.ID != 0
}

// processHistoryStory handles a status@broadcast message from HistorySync.
// Returns true if a new story was inserted.
func (t *Tracker) processHistoryStory(webMsg *waWeb.WebMessageInfo) bool {
	key := webMsg.GetKey()
	if key == nil {
		return false
	}
	if key.GetRemoteJID() != types.StatusBroadcastJID.String() {
		return false
	}

	msgID := key.GetID()
	if msgID == "" {
		return false
	}
	ts := int64(webMsg.GetMessageTimestamp())
	if ts == 0 {
		return false
	}

	// Sender is in the participant field for broadcast messages.
	participantStr := key.GetParticipant()
	if participantStr == "" {
		return false
	}
	senderJID, err := types.ParseJID(participantStr)
	if err != nil {
		return false
	}
	senderJID = senderJID.ToNonAD()
	senderStr := senderJID.String()

	slog.Debug("tracker: history story candidate", "accountID", t.accountID, "from", senderStr, "storyID", msgID)

	// Only store stories from tracked contacts.
	// Try both LID and phone JID so we handle either addressing mode.
	contactID := t.resolveStoryContact(senderJID)
	if contactID == nil {
		slog.Debug("tracker: history story from untracked contact, skipping", "accountID", t.accountID, "from", senderStr)
		return false
	}

	msg := webMsg.GetMessage()
	if msg == nil {
		return false
	}
	if msg.GetProtocolMessage() != nil || msg.GetReactionMessage() != nil {
		return false
	}

	text := extractText(msg)
	mediaType := extractMediaType(msg)
	var mediaPath string

	// Attempt to download media — stories expire so grab them immediately.
	if mediaType != "" && t.mediaDir != "" {
		if downloadable := getDownloadable(msg); downloadable != nil {
			data, err := t.wa.DownloadMedia(t.ctx, downloadable)
			if err != nil {
				slog.Warn("tracker: history story download failed", "accountID", t.accountID, "storyID", msgID, "err", err)
			} else {
				ext := getExtension(mediaType, msg)
				filename := fmt.Sprintf("story_%d_%s%s", t.accountID, msgID, ext)
				fullPath := filepath.Join(t.mediaDir, filename)
				if err := os.WriteFile(fullPath, data, 0o644); err != nil {
					slog.Error("tracker: history story save failed", "accountID", t.accountID, "storyID", msgID, "err", err)
				} else {
					mediaPath = filename
				}
			}
		}
	}

	now := time.Now().Unix()
	saved, err := t.db.InsertStory(t.ctx, db.Story{
		AccountID:  t.accountID,
		ContactID:  contactID,
		SenderJID:  senderStr,
		StoryID:    msgID,
		MediaType:  mediaType,
		MediaPath:  mediaPath,
		Caption:    text,
		PostedAt:   ts,
		ReceivedAt: now,
	})
	if err != nil {
		slog.Error("tracker: history story insert failed", "accountID", t.accountID, "storyID", msgID, "err", err)
		return false
	}
	return saved.ID != 0
}
