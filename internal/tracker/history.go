package tracker

import (
	"log/slog"
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
	for _, conv := range convs {
		for _, histMsg := range conv.GetMessages() {
			webMsg := histMsg.GetMessage()
			if webMsg == nil {
				continue
			}
			if t.processHistoryMessage(webMsg) {
				inserted++
			}
		}
	}

	if inserted > 0 {
		slog.Info("tracker: history sync stored new messages", "accountID", t.accountID, "count", inserted)
		t.hub.Broadcast("history_sync", map[string]any{"accountId": t.accountID})
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
