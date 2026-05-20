package tracker

import (
	"context"
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"

	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/analytics"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/config"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/wa"
)

// Hub is the minimum interface the tracker uses to broadcast updates.
type Hub interface {
	Broadcast(kind string, payload any)
}

// TrackerManager owns one Tracker per account.
type TrackerManager struct {
	mu       sync.RWMutex
	trackers map[int64]*Tracker
}

func NewTrackerManager() *TrackerManager {
	return &TrackerManager{trackers: make(map[int64]*Tracker)}
}

// Add registers a new account tracker. If one already exists for this account it is returned as-is.
func (m *TrackerManager) Add(accountID int64, deps Deps) *Tracker {
	m.mu.Lock()
	defer m.mu.Unlock()
	if t, ok := m.trackers[accountID]; ok {
		return t
	}
	t := newTracker(accountID, deps)
	m.trackers[accountID] = t
	return t
}

// Get returns the Tracker for an account, or nil.
func (m *TrackerManager) Get(accountID int64) *Tracker {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.trackers[accountID]
}

// Remove stops and removes a tracker.
func (m *TrackerManager) Remove(accountID int64) {
	m.mu.Lock()
	t, ok := m.trackers[accountID]
	if ok {
		delete(m.trackers, accountID)
	}
	m.mu.Unlock()
	if t != nil {
		t.Stop()
	}
}

// StopAll stops all trackers.
func (m *TrackerManager) StopAll() {
	m.mu.RLock()
	ts := make([]*Tracker, 0, len(m.trackers))
	for _, t := range m.trackers {
		ts = append(ts, t)
	}
	m.mu.RUnlock()
	for _, t := range ts {
		t.Stop()
	}
}

// SubscribeContact delegates to the correct account's tracker.
func (m *TrackerManager) SubscribeContact(ctx context.Context, c db.Contact) {
	t := m.Get(c.AccountID)
	if t == nil {
		slog.Warn("tracker manager: no tracker for account", "accountID", c.AccountID)
		return
	}
	t.SubscribeContact(ctx, c)
}

// ---------------------------------------------------------------------------

type Deps struct {
	WA       *wa.Client
	DB       *db.DB
	Hub      Hub
	Interval time.Duration
	MediaDir string
}

type Tracker struct {
	accountID int64
	wa        *wa.Client
	db        *db.DB
	hub       Hub
	interval  time.Duration
	mediaDir  string

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	mu      sync.Mutex
	running bool

	backoffMu    sync.RWMutex
	backoffUntil time.Time
}

func newTracker(accountID int64, d Deps) *Tracker {
	ctx, cancel := context.WithCancel(context.Background())
	return &Tracker{
		accountID: accountID,
		wa:        d.WA,
		db:        d.DB,
		hub:       d.Hub,
		interval:  d.Interval,
		mediaDir:  d.MediaDir,
		ctx:       ctx,
		cancel:    cancel,
	}
}

// New creates a standalone tracker (single-account convenience wrapper).
func New(d Deps) *Tracker {
	return newTracker(0, d)
}

func (t *Tracker) Stop() {
	slog.Info("tracker: stopping", "accountID", t.accountID)
	t.cancel()
	t.wg.Wait()
	slog.Info("tracker: stopped", "accountID", t.accountID)
}

// HandleEvent is the single entry point for whatsmeow events. Wired into wa.Client.AttachHandler.
func (t *Tracker) HandleEvent(evt any) {
	switch v := evt.(type) {
	case *events.Connected:
		slog.Log(t.ctx, config.LevelAudit, "tracker: connected", "accountID", t.accountID, "jid", t.wa.OwnJID())
		t.hub.Broadcast("auth.linked", map[string]any{"accountID": t.accountID, "ownJID": t.wa.OwnJID()})
		t.onConnected()

	case *events.Disconnected:
		slog.Log(t.ctx, config.LevelAudit, "tracker: disconnected", "accountID", t.accountID)

	case *events.LoggedOut:
		slog.Log(t.ctx, config.LevelAudit, "tracker: logged out", "accountID", t.accountID, "reason", v.Reason.String())
		t.hub.Broadcast("auth.logout", map[string]any{"accountID": t.accountID, "reason": v.Reason.String()})
		t.stopWorkers()

	case *events.PairSuccess:
		slog.Log(t.ctx, config.LevelAudit, "tracker: pair success", "accountID", t.accountID, "jid", v.ID.String())

	case *events.Presence:
		t.onPresence(v)

	case *events.Message:
		t.onMessage(v)

	case *events.Receipt:
		// Receipts are used to track outgoing messages from this account sent on other devices.
		if v.Type == types.ReceiptTypeRead || v.Type == types.ReceiptTypeReadSelf {
			// We only care about message content, which is in events.Message.
			// However, some whatsmeow versions might deliver outgoing messages as receipts.
			// For now, onMessage handles info.IsFromMe correctly.
		}
	}
}

func (t *Tracker) onConnected() {
	t.mu.Lock()
	if t.running {
		t.mu.Unlock()
		return
	}
	t.running = true
	t.mu.Unlock()

	// SendAvailable must be called before subscribing to presence so WhatsApp
	// knows to push events to us.
	if err := t.wa.SendAvailable(t.ctx); err != nil {
		slog.Warn("tracker: send available failed", "accountID", t.accountID, "err", err)
	}

	slog.Info("tracker: starting workers", "accountID", t.accountID, "poll_interval", t.interval)
	t.wg.Add(4)
	go t.runPictureLoop()
	go t.runAboutLoop()
	go t.runResubLoop()
	go func() {
		defer t.wg.Done()
		t.startSubscriptions()
	}()
}

func (t *Tracker) stopWorkers() {
	t.mu.Lock()
	t.running = false
	t.mu.Unlock()
	slog.Info("tracker: workers stopped", "accountID", t.accountID)
}

func (t *Tracker) startSubscriptions() {
	contacts, err := t.db.ListTrackedContacts(t.ctx, t.accountID)
	if err != nil {
		slog.Error("tracker: list contacts for subscription", "accountID", t.accountID, "err", err)
		return
	}
	slog.Info("tracker: subscribing to presence", "accountID", t.accountID, "count", len(contacts))
	failed := 0
	for _, c := range contacts {
		jid, err := types.ParseJID(c.JID)
		if err != nil {
			slog.Error("tracker: invalid jid", "accountID", t.accountID, "jid", c.JID, "err", err)
			failed++
			continue
		}
		if err := t.wa.SubscribePresence(t.ctx, jid); err != nil {
			slog.Warn("tracker: subscribe presence failed", "accountID", t.accountID, "jid", c.JID, "err", err)
			failed++
		} else {
			slog.Debug("tracker: subscribed", "accountID", t.accountID, "jid", c.JID)
			if c.LID == "" {
				t.storeLID(c, jid)
			}
		}
	}
	if failed > 0 {
		slog.Warn("tracker: some subscriptions failed", "accountID", t.accountID, "failed", failed, "total", len(contacts))
	}
}

// SubscribeContact lets the API tell us about a freshly added contact.
func (t *Tracker) SubscribeContact(ctx context.Context, c db.Contact) {
	if !t.wa.IsConnected() || !c.TrackingEnabled {
		slog.Debug("tracker: skip subscribe (not connected or tracking disabled)",
			"accountID", t.accountID, "jid", c.JID, "connected", t.wa.IsConnected(), "tracking", c.TrackingEnabled)
		return
	}
	jid, err := types.ParseJID(c.JID)
	if err != nil {
		slog.Error("tracker: invalid jid for subscribe", "accountID", t.accountID, "jid", c.JID, "err", err)
		return
	}
	if err := t.wa.SubscribePresence(ctx, jid); err != nil {
		slog.Warn("tracker: subscribe presence failed", "accountID", t.accountID, "jid", c.JID, "err", err)
		return
	}
	slog.Info("tracker: subscribed to presence", "accountID", t.accountID, "jid", c.JID)
	t.storeLID(c, jid)
}

// storeLID fetches the LID for a contact from WhatsApp and persists it.
func (t *Tracker) storeLID(c db.Contact, jid types.JID) {
	lid, err := t.wa.GetLIDForJID(t.ctx, jid)
	if err != nil {
		slog.Warn("tracker: fetch LID failed", "accountID", t.accountID, "jid", c.JID, "err", err)
		return
	}
	if lid.IsEmpty() {
		slog.Debug("tracker: no LID for contact", "accountID", t.accountID, "jid", c.JID)
		return
	}
	lidStr := lid.ToNonAD().String()
	if err := t.db.UpdateContactLID(t.ctx, c.ID, lidStr); err != nil {
		slog.Error("tracker: store LID failed", "accountID", t.accountID, "jid", c.JID, "lid", lidStr, "err", err)
		return
	}
	slog.Info("tracker: stored LID", "accountID", t.accountID, "jid", c.JID, "lid", lidStr)
}

// onPresence persists a presence event (deduping flips of the same state) and broadcasts.
func (t *Tracker) onPresence(p *events.Presence) {
	fromJID := p.From.ToNonAD()
	jidStr := fromJID.String()
	slog.Debug("tracker: presence event received", "accountID", t.accountID, "jid", jidStr, "unavailable", p.Unavailable, "last_seen", p.LastSeen)

	// WhatsApp sends presence events using the LID (anonymous ID) rather than
	// the phone JID. Try LID lookup first, fall back to phone JID.
	var c db.Contact
	var err error
	if fromJID.Server == types.HiddenUserServer {
		c, err = t.db.GetContactByLID(t.ctx, t.accountID, jidStr)
	} else {
		c, err = t.db.GetContactByJID(t.ctx, t.accountID, jidStr)
	}
	if err != nil {
		slog.Debug("tracker: presence event for untracked jid, dropping", "accountID", t.accountID, "jid", jidStr, "err", err)
		return
	}

	state := "available"
	if p.Unavailable {
		state = "unavailable"
	}
	var lastSeen *int64
	if !p.LastSeen.IsZero() {
		ls := p.LastSeen.Unix()
		lastSeen = &ls
	}
	now := time.Now().Unix()

	prev, _ := t.db.LatestPresence(t.ctx, c.ID)
	sameState := prev.State == state
	sameLastSeen := equalIntPtr(prev.LastSeen, lastSeen)
	if sameState && sameLastSeen {
		slog.Debug("tracker: presence unchanged, skipping", "accountID", t.accountID, "jid", jidStr, "state", state)
		return
	}

	ev, err := t.db.InsertPresence(t.ctx, c.ID, state, lastSeen, now)
	if err != nil {
		slog.Error("tracker: insert presence failed", "accountID", t.accountID, "jid", jidStr, "contact_id", c.ID, "err", err)
		return
	}

	slog.Info("tracker: presence update", "accountID", t.accountID, "jid", jidStr, "contact_id", c.ID, "state", state, "observed_at", ev.ObservedAt)
	t.hub.Broadcast("presence", map[string]any{
		"accountId":  t.accountID,
		"contactId":  c.ID,
		"jid":        c.JID,
		"state":      state,
		"lastSeen":   lastSeen,
		"observedAt": ev.ObservedAt,
	})
}

// onMessage stores an incoming real-time message.
func (t *Tracker) onMessage(msg *events.Message) {
	info := msg.Info
	now := time.Now().Unix()

	// Determine text and media type.
	text := extractText(msg.Message)
	mediaType := extractMediaType(msg.Message)
	var mediaPath string

	// Download media if available.
	if mediaType != "" && t.mediaDir != "" {
		if downloadable := getDownloadable(msg.Message); downloadable != nil {
			data, err := t.wa.DownloadMedia(t.ctx, downloadable)
			if err != nil {
				slog.Warn("tracker: download media failed", "accountID", t.accountID, "messageID", info.ID, "err", err)
			} else {
				ext := getExtension(mediaType, msg.Message)
				filename := fmt.Sprintf("%d_%s%s", t.accountID, info.ID, ext)
				mediaPath = filename // store just the filename in DB
				fullPath := filepath.Join(t.mediaDir, filename)
				if err := os.WriteFile(fullPath, data, 0o644); err != nil {
					slog.Error("tracker: save media failed", "accountID", t.accountID, "messageID", info.ID, "err", err)
					mediaPath = ""
				} else {
					slog.Debug("tracker: media saved", "accountID", t.accountID, "messageID", info.ID, "path", fullPath)
				}
			}
		}
	}

	// Try to resolve the contact by sender JID.
	senderJID := info.Sender.ToNonAD()
	senderStr := senderJID.String()

	var contactID *int64
	if senderJID.Server == types.HiddenUserServer {
		c, err := t.db.GetContactByLID(t.ctx, t.accountID, senderStr)
		if err == nil {
			contactID = &c.ID
		}
	} else {
		c, err := t.db.GetContactByJID(t.ctx, t.accountID, senderStr)
		if err == nil {
			contactID = &c.ID
		}
	}

	chatJID := info.Chat.ToNonAD()
	chatStr := chatJID.String()

	if contactID == nil {
		// Try resolving by Chat JID (for messages sent by me in 1-to-1)
		if chatJID.Server == types.HiddenUserServer {
			c, err := t.db.GetContactByLID(t.ctx, t.accountID, chatStr)
			if err == nil {
				contactID = &c.ID
			}
		} else {
			c, err := t.db.GetContactByJID(t.ctx, t.accountID, chatStr)
			if err == nil {
				contactID = &c.ID
			}
		}
	}

	m := db.Message{
		AccountID:  t.accountID,
		ContactID:  contactID,
		ChatJID:    chatStr,
		MessageID:  info.ID,
		SenderJID:  senderStr,
		IsFromMe:   info.IsFromMe,
		Timestamp:  info.Timestamp.Unix(),
		Text:       text,
		MediaType:  mediaType,
		MediaPath:  mediaPath,
		ReceivedAt: now,
	}
	f := analytics.ExtractFeatures(m.Text, time.Unix(m.Timestamp, 0))
	saved, err := t.db.InsertMessageWithAnalytics(t.ctx, m, f)
	if err != nil {
		slog.Error("tracker: insert message failed", "accountID", t.accountID, "messageID", info.ID, "err", err)
		return
	}
	if saved.ID != 0 {
		slog.Debug("tracker: message stored", "accountID", t.accountID, "messageID", info.ID, "chat", chatStr, "from", senderStr)
	}

	// If we found a contact, also record a presence event to mark them active/online.
	if contactID != nil && !info.IsFromMe {
		_, _ = t.db.InsertPresence(t.ctx, *contactID, "available", nil, now)
		t.hub.Broadcast("presence", map[string]any{
			"accountId":  t.accountID,
			"contactId":  *contactID,
			"jid":        senderStr,
			"state":      "available",
			"observedAt": now,
		})
	}

	t.hub.Broadcast("message", map[string]any{
		"accountId": t.accountID,
		"contactId": contactID,
		"chatJid":   chatStr,
		"messageId": info.ID,
		"from":      senderStr,
		"isFromMe":  info.IsFromMe,
		"text":      text,
		"mediaType": mediaType,
		"mediaPath": mediaPath,
		"timestamp": info.Timestamp.Unix(),
	})
}

func extractText(msg *waE2E.Message) string {
	if msg == nil {
		return ""
	}
	if t := msg.GetConversation(); t != "" {
		return t
	}
	if ext := msg.GetExtendedTextMessage(); ext != nil {
		return ext.GetText()
	}
	if img := msg.GetImageMessage(); img != nil {
		return img.GetCaption()
	}
	if vid := msg.GetVideoMessage(); vid != nil {
		return vid.GetCaption()
	}
	if doc := msg.GetDocumentMessage(); doc != nil {
		return doc.GetCaption()
	}
	if dwc := msg.GetDocumentWithCaptionMessage(); dwc != nil && dwc.Message != nil {
		return dwc.Message.GetDocumentMessage().GetCaption()
	}
	return ""
}

func extractMediaType(msg *waE2E.Message) string {
	if msg == nil {
		return ""
	}
	if msg.ImageMessage != nil {
		return "image"
	}
	if msg.VideoMessage != nil {
		return "video"
	}
	if msg.AudioMessage != nil {
		return "audio"
	}
	if msg.DocumentMessage != nil || msg.DocumentWithCaptionMessage != nil {
		return "document"
	}
	if msg.StickerMessage != nil {
		return "sticker"
	}
	return ""
}

func (t *Tracker) runResubLoop() {
	defer t.wg.Done()
	tick := time.NewTicker(5 * time.Minute)
	defer tick.Stop()
	for {
		select {
		case <-t.ctx.Done():
			return
		case <-tick.C:
			if !t.isRunning() || !t.wa.IsConnected() {
				continue
			}
			slog.Debug("tracker: re-subscribing to presence", "accountID", t.accountID)
			t.startSubscriptions()
		}
	}
}

func (t *Tracker) isRunning() bool {
	t.mu.Lock()
	defer t.mu.Unlock()
	return t.running
}

func equalIntPtr(a, b *int64) bool {
	if a == nil && b == nil {
		return true
	}
	if a == nil || b == nil {
		return false
	}
	return *a == *b
}

func bytesHex(b []byte) string {
	if len(b) == 0 {
		return ""
	}
	return hex.EncodeToString(b)
}

func getDownloadable(msg *waE2E.Message) any {
	if msg == nil {
		return nil
	}
	if msg.ImageMessage != nil {
		return msg.ImageMessage
	}
	if msg.VideoMessage != nil {
		return msg.VideoMessage
	}
	if msg.AudioMessage != nil {
		return msg.AudioMessage
	}
	if msg.DocumentMessage != nil {
		return msg.DocumentMessage
	}
	if msg.DocumentWithCaptionMessage != nil && msg.DocumentWithCaptionMessage.Message != nil {
		return msg.DocumentWithCaptionMessage.Message.DocumentMessage
	}
	if msg.StickerMessage != nil {
		return msg.StickerMessage
	}
	return nil
}

func getExtension(mediaType string, msg *waE2E.Message) string {
	switch mediaType {
	case "image":
		return ".jpg"
	case "video":
		return ".mp4"
	case "audio":
		return ".ogg"
	case "sticker":
		return ".webp"
	case "document":
		if msg.DocumentMessage != nil && msg.DocumentMessage.FileName != nil {
			if ext := filepath.Ext(*msg.DocumentMessage.FileName); ext != "" {
				return ext
			}
		}
		return ".bin"
	default:
		return ".bin"
	}
}
