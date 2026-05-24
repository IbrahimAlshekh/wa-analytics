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

// ApplySchedule updates the schedule for one account's tracker.
func (m *TrackerManager) ApplySchedule(accountID int64, forceOffline bool, slots []db.ScheduleSlot) {
	t := m.Get(accountID)
	if t == nil {
		slog.Warn("tracker manager: no tracker for account", "accountID", accountID)
		return
	}
	t.ApplySchedule(forceOffline, slots)
}

// RefreshContactPicture triggers an immediate picture check for one contact,
// throttled internally to once per 5 minutes.
func (m *TrackerManager) RefreshContactPicture(accountID, contactID int64) {
	t := m.Get(accountID)
	if t == nil {
		return
	}
	go t.RefreshContactPicture(contactID)
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

	scheduleMu    sync.RWMutex
	forceOffline  bool
	scheduleSlots []db.ScheduleSlot

	pictureFetchAt sync.Map // int64 contactID → int64 unix seconds

	// inferredOnline tracks auto-offline timers for contacts whose WhatsApp
	// status is hidden — we infer "available" from messages/typing but must
	// reset to "unavailable" after 2 minutes of silence.
	inferredMu     sync.Mutex
	inferredOnline map[int64]*time.Timer // contactID → pending offline timer
}

func newTracker(accountID int64, d Deps) *Tracker {
	ctx, cancel := context.WithCancel(context.Background())
	return &Tracker{
		accountID:      accountID,
		wa:             d.WA,
		db:             d.DB,
		hub:            d.Hub,
		interval:       d.Interval,
		mediaDir:       d.MediaDir,
		ctx:            ctx,
		cancel:         cancel,
		inferredOnline: make(map[int64]*time.Timer),
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
	t.inferredMu.Lock()
	for id, timer := range t.inferredOnline {
		timer.Stop()
		delete(t.inferredOnline, id)
	}
	t.inferredMu.Unlock()
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

	case *events.HistorySync:
		go t.onHistorySync(v)

	case *events.Presence:
		t.onPresence(v)

	case *events.ChatPresence:
		t.onChatPresence(v)

	case *events.Message:
		t.onMessage(v)

	case *events.Receipt:
		// Receipts are used to track outgoing messages from this account sent on other devices.
		if v.Type == types.ReceiptTypeRead || v.Type == types.ReceiptTypeReadSelf {
			// We only care about message content, which is in events.Message.
			// However, some whatsmeow versions might deliver outgoing messages as receipts.
			// For now, onMessage handles info.IsFromMe correctly.
		}

	case *events.UndecryptableMessage:
		chat := v.Info.Chat.ToNonAD()
		if chat.Server == types.BroadcastServer && chat.User == types.StatusBroadcastJID.User {
			slog.Warn("tracker: undecryptable story — sender key missing, story cannot be saved",
				"accountID", t.accountID, "from", v.Info.Sender.String(), "alt", v.Info.SenderAlt.String(), "storyID", v.Info.ID)
		} else {
			slog.Debug("tracker: undecryptable message", "accountID", t.accountID, "from", v.Info.Sender.String(), "chat", chat.String())
		}
	}
}

func (t *Tracker) onConnected() {
	// SendAvailable must be called on every (re)connection so WhatsApp knows
	// to push presence events to us. It must happen before subscribing.
	if err := t.wa.SendAvailable(t.ctx); err != nil {
		slog.Warn("tracker: send available failed", "accountID", t.accountID, "err", err)
	}

	t.mu.Lock()
	firstConnect := !t.running
	t.running = true
	t.mu.Unlock()

	if firstConnect {
		slog.Info("tracker: starting workers", "accountID", t.accountID, "poll_interval", t.interval)
		t.wg.Add(5)
		go t.runPictureLoop()
		go t.runAboutLoop()
		go t.runResubLoop()
		go t.runScheduleLoop()
		go func() {
			defer t.wg.Done()
			t.startSubscriptions()
		}()
	} else {
		// Reconnected: re-subscribe without spinning up additional worker goroutines.
		slog.Info("tracker: reconnected — refreshing presence subscriptions", "accountID", t.accountID)
		go t.startSubscriptions()
	}
}

func (t *Tracker) stopWorkers() {
	t.mu.Lock()
	t.running = false
	t.mu.Unlock()
	slog.Info("tracker: workers stopped", "accountID", t.accountID)
}

// startSubscriptions subscribes to presence for all tracked contacts.
// Calls are spread out over time to avoid triggering WhatsApp rate-limits.
func (t *Tracker) startSubscriptions() {
	if t.checkBackoff() {
		slog.Debug("tracker: skipping subscriptions — in rate-limit backoff", "accountID", t.accountID)
		return
	}

	contacts, err := t.db.ListTrackedContacts(t.ctx, t.accountID)
	if err != nil {
		slog.Error("tracker: list contacts for subscription", "accountID", t.accountID, "err", err)
		return
	}
	n := len(contacts)
	if n == 0 {
		return
	}

	// Spread N calls evenly across ~90 s to avoid bursting the subscription API.
	// Floor: 400 ms (fast enough); ceiling: 3 s (no point spreading wider).
	gap := 90 * time.Second / time.Duration(n)
	if gap < 400*time.Millisecond {
		gap = 400 * time.Millisecond
	}
	if gap > 3*time.Second {
		gap = 3 * time.Second
	}

	slog.Info("tracker: subscribing to presence", "accountID", t.accountID, "count", n, "gap", gap)
	failed := 0
	for i, c := range contacts {
		select {
		case <-t.ctx.Done():
			return
		default:
		}
		if t.checkBackoff() {
			slog.Debug("tracker: stopping subscriptions — entered backoff mid-loop", "accountID", t.accountID)
			return
		}

		jid, err := types.ParseJID(c.JID)
		if err != nil {
			slog.Error("tracker: invalid jid", "accountID", t.accountID, "jid", c.JID, "err", err)
			failed++
			continue
		}
		if err := t.wa.SubscribePresence(t.ctx, jid); err != nil {
			if isRateLimit(err) {
				slog.Log(t.ctx, config.LevelAudit, "tracker: rate limited on SubscribePresence — backing off",
					"accountID", t.accountID, "jid", c.JID, "err", err)
				t.setBackoff(5 * time.Minute)
				return
			}
			slog.Warn("tracker: subscribe presence failed", "accountID", t.accountID, "jid", c.JID, "err", err)
			failed++
		} else {
			slog.Debug("tracker: subscribed", "accountID", t.accountID, "jid", c.JID)
			if c.LID == "" {
				t.storeLID(c, jid)
			}
		}

		// Sleep between calls, skipping the gap after the last contact.
		if i < n-1 {
			select {
			case <-t.ctx.Done():
				return
			case <-time.After(gap):
			}
		}
	}

	if failed > 0 {
		slog.Warn("tracker: some subscriptions failed", "accountID", t.accountID, "failed", failed, "total", n)
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
		if isRateLimit(err) {
			t.setBackoff(5 * time.Minute)
		}
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

	// Real presence event from WhatsApp takes priority — cancel any inferred timer.
	t.cancelInferredOffline(c.ID)

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
	// For "available" deduplicate on state alone — consecutive available events
	// are the same ongoing session regardless of whether lastSeen changes.
	// For "unavailable" also require lastSeen to match so a new last-seen
	// timestamp from WhatsApp still gets stored.
	if sameState && (state == "available" || equalIntPtr(prev.LastSeen, lastSeen)) {
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

// onChatPresence handles typing indicators. For contacts with hidden presence
// status, a "composing" event is treated as evidence of activity: mark online
// and reset the 2-minute auto-offline timer.
func (t *Tracker) onChatPresence(cp *events.ChatPresence) {
	if cp.IsFromMe || cp.State != types.ChatPresenceComposing {
		return
	}
	fromJID := cp.Sender.ToNonAD()
	jidStr := fromJID.String()

	var c db.Contact
	var err error
	if fromJID.Server == types.HiddenUserServer {
		c, err = t.db.GetContactByLID(t.ctx, t.accountID, jidStr)
	} else {
		c, err = t.db.GetContactByJID(t.ctx, t.accountID, jidStr)
	}
	if err != nil {
		return
	}

	now := time.Now().Unix()
	prev, _ := t.db.LatestPresence(t.ctx, c.ID)
	if prev.State != "available" {
		if _, err := t.db.InsertPresence(t.ctx, c.ID, "available", nil, now); err == nil {
			slog.Info("tracker: inferred online from typing", "accountID", t.accountID, "contact_id", c.ID)
			t.hub.Broadcast("presence", map[string]any{
				"accountId":  t.accountID,
				"contactId":  c.ID,
				"jid":        c.JID,
				"state":      "available",
				"observedAt": now,
			})
		}
	}
	t.scheduleInferredOffline(c.ID, c.JID)
}

// scheduleInferredOffline starts (or resets) a 2-minute timer that will mark a
// contact unavailable if no further messages, typing events, or real presence
// events arrive. Only applies when the contact's WhatsApp status is hidden and
// we are inferring their online state from activity.
func (t *Tracker) scheduleInferredOffline(contactID int64, jidStr string) {
	const timeout = 2 * time.Minute

	t.inferredMu.Lock()
	defer t.inferredMu.Unlock()

	if timer, ok := t.inferredOnline[contactID]; ok {
		timer.Reset(timeout)
		return
	}

	t.inferredOnline[contactID] = time.AfterFunc(timeout, func() {
		t.inferredMu.Lock()
		delete(t.inferredOnline, contactID)
		t.inferredMu.Unlock()

		now := time.Now().Unix()
		prev, _ := t.db.LatestPresence(t.ctx, contactID)
		if prev.State != "available" {
			return
		}
		if _, err := t.db.InsertPresence(t.ctx, contactID, "unavailable", nil, now); err != nil {
			slog.Error("tracker: inferred offline insert failed", "accountID", t.accountID, "contact_id", contactID, "err", err)
			return
		}
		slog.Info("tracker: inferred offline — no activity for 2m", "accountID", t.accountID, "contact_id", contactID)
		t.hub.Broadcast("presence", map[string]any{
			"accountId":  t.accountID,
			"contactId":  contactID,
			"jid":        jidStr,
			"state":      "unavailable",
			"observedAt": now,
		})
	})
}

// cancelInferredOffline cancels a pending auto-offline timer for a contact.
// Called when a real WhatsApp presence event arrives, so the real status wins.
func (t *Tracker) cancelInferredOffline(contactID int64) {
	t.inferredMu.Lock()
	defer t.inferredMu.Unlock()
	if timer, ok := t.inferredOnline[contactID]; ok {
		timer.Stop()
		delete(t.inferredOnline, contactID)
	}
}

// resolveContactForEvent finds the contact ID for a sender JID, falling back to the
// chat JID (used for outgoing messages where sender == own JID).
func (t *Tracker) resolveContactForEvent(senderJID, chatJID types.JID) *int64 {
	lookup := func(jid types.JID) *int64 {
		s := jid.String()
		var c db.Contact
		var err error
		if jid.Server == types.HiddenUserServer {
			c, err = t.db.GetContactByLID(t.ctx, t.accountID, s)
		} else {
			c, err = t.db.GetContactByJID(t.ctx, t.accountID, s)
		}
		if err == nil {
			return &c.ID
		}
		return nil
	}
	if id := lookup(senderJID); id != nil {
		return id
	}
	return lookup(chatJID)
}

// onMessage stores an incoming real-time message.
func (t *Tracker) onMessage(msg *events.Message) {
	// Stories arrive as messages to status@broadcast — route them separately.
	chat := msg.Info.Chat.ToNonAD()
	if chat.Server == types.BroadcastServer && chat.User == types.StatusBroadcastJID.User {
		t.onStory(msg)
		return
	}

	info := msg.Info
	now := time.Now().Unix()

	// ── Special message actions ──────────────────────────────────────────────
	// Reactions, deletions, and edits arrive as events.Message but are not
	// regular chat messages. Handle them first and return early.

	if reaction := msg.Message.GetReactionMessage(); reaction != nil {
		targetID := reaction.GetKey().GetID()
		if targetID == "" {
			return
		}
		contactID := t.resolveContactForEvent(info.Sender.ToNonAD(), info.Chat.ToNonAD())
		if err := t.db.InsertMessageEvent(t.ctx, db.MessageEvent{
			AccountID:       t.accountID,
			ContactID:       contactID,
			TargetMessageID: targetID,
			Kind:            "reaction",
			ActorJID:        info.Sender.ToNonAD().String(),
			IsFromMe:        info.IsFromMe,
			Emoji:           reaction.GetText(),
			ObservedAt:      now,
		}); err != nil {
			slog.Warn("tracker: insert reaction event failed", "accountID", t.accountID, "err", err)
		}
		if contactID != nil {
			t.hub.Broadcast("message_event", map[string]any{"accountId": t.accountID, "contactId": *contactID})
		}
		return
	}

	if proto := msg.Message.GetProtocolMessage(); proto != nil {
		targetID := proto.GetKey().GetID()
		if targetID == "" {
			return
		}
		contactID := t.resolveContactForEvent(info.Sender.ToNonAD(), info.Chat.ToNonAD())
		switch proto.GetType() {
		case waE2E.ProtocolMessage_REVOKE:
			if err := t.db.InsertMessageEvent(t.ctx, db.MessageEvent{
				AccountID:       t.accountID,
				ContactID:       contactID,
				TargetMessageID: targetID,
				Kind:            "delete",
				ActorJID:        info.Sender.ToNonAD().String(),
				IsFromMe:        info.IsFromMe,
				ObservedAt:      now,
			}); err != nil {
				slog.Warn("tracker: insert delete event failed", "accountID", t.accountID, "err", err)
			} else if contactID != nil {
				t.hub.Broadcast("message_event", map[string]any{"accountId": t.accountID, "contactId": *contactID})
			}
		case waE2E.ProtocolMessage_MESSAGE_EDIT:
			newText := extractText(proto.GetEditedMessage())
			if err := t.db.InsertMessageEvent(t.ctx, db.MessageEvent{
				AccountID:       t.accountID,
				ContactID:       contactID,
				TargetMessageID: targetID,
				Kind:            "edit",
				ActorJID:        info.Sender.ToNonAD().String(),
				IsFromMe:        info.IsFromMe,
				NewText:         newText,
				ObservedAt:      now,
			}); err != nil {
				slog.Warn("tracker: insert edit event failed", "accountID", t.accountID, "err", err)
			} else if contactID != nil {
				t.hub.Broadcast("message_event", map[string]any{"accountId": t.accountID, "contactId": *contactID})
			}
		}
		return
	}

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
		AccountID:       t.accountID,
		ContactID:       contactID,
		ChatJID:         chatStr,
		MessageID:       info.ID,
		SenderJID:       senderStr,
		IsFromMe:        info.IsFromMe,
		Timestamp:       info.Timestamp.Unix(),
		Text:            text,
		MediaType:       mediaType,
		MediaPath:       mediaPath,
		ReceivedAt:      now,
		QuotedMessageID: extractQuotedMessageID(msg.Message),
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

	// If we found a contact, record an "available" presence event — but only
	// if the contact isn't already marked online, so incoming messages don't
	// push the session start forward with every new message.
	// Also schedule an auto-offline after 2 minutes; this is cancelled if a
	// real WhatsApp presence event (available/unavailable) arrives first.
	if contactID != nil && !info.IsFromMe {
		prev, _ := t.db.LatestPresence(t.ctx, *contactID)
		if prev.State != "available" {
			_, _ = t.db.InsertPresence(t.ctx, *contactID, "available", nil, now)
			t.hub.Broadcast("presence", map[string]any{
				"accountId":  t.accountID,
				"contactId":  *contactID,
				"jid":        senderStr,
				"state":      "available",
				"observedAt": now,
			})
		}
		t.scheduleInferredOffline(*contactID, senderStr)
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

// resolveStoryContact tries to find a tracked contact for a story sender,
// checking both primary and alternate JIDs (LID / phone) so we don't miss a
// story just because the sender key happened to arrive as a LID instead of a
// phone JID (or vice versa).
func (t *Tracker) resolveStoryContact(jids ...types.JID) *int64 {
	for _, jid := range jids {
		if jid.IsEmpty() {
			continue
		}
		s := jid.String()
		var c db.Contact
		var err error
		if jid.Server == types.HiddenUserServer {
			c, err = t.db.GetContactByLID(t.ctx, t.accountID, s)
		} else {
			c, err = t.db.GetContactByJID(t.ctx, t.accountID, s)
		}
		if err == nil {
			return &c.ID
		}
	}
	return nil
}

// onStory handles a WhatsApp Status/Story update (chat == status@broadcast).
func (t *Tracker) onStory(msg *events.Message) {
	info := msg.Info
	now := time.Now().Unix()

	senderJID := info.Sender.ToNonAD()
	senderStr := senderJID.String()

	slog.Debug("tracker: story event received", "accountID", t.accountID, "from", senderStr, "alt", info.SenderAlt.String(), "storyID", info.ID)

	// Only persist stories from tracked contacts.
	// Try primary sender JID, then the alternate address (LID ↔ phone fallback).
	contactID := t.resolveStoryContact(senderJID, info.SenderAlt.ToNonAD())
	if contactID == nil {
		slog.Debug("tracker: story from untracked contact, skipping", "accountID", t.accountID, "from", senderStr, "alt", info.SenderAlt.String())
		return
	}

	text := extractText(msg.Message)
	mediaType := extractMediaType(msg.Message)
	var mediaPath string

	if mediaType != "" && t.mediaDir != "" {
		if downloadable := getDownloadable(msg.Message); downloadable != nil {
			data, err := t.wa.DownloadMedia(t.ctx, downloadable)
			if err != nil {
				slog.Warn("tracker: story download media failed", "accountID", t.accountID, "storyID", info.ID, "err", err)
			} else {
				ext := getExtension(mediaType, msg.Message)
				filename := fmt.Sprintf("story_%d_%s%s", t.accountID, info.ID, ext)
				fullPath := filepath.Join(t.mediaDir, filename)
				if err := os.WriteFile(fullPath, data, 0o644); err != nil {
					slog.Error("tracker: story save media failed", "accountID", t.accountID, "storyID", info.ID, "err", err)
				} else {
					mediaPath = filename
				}
			}
		}
	}

	s := db.Story{
		AccountID:  t.accountID,
		ContactID:  contactID,
		SenderJID:  senderStr,
		StoryID:    info.ID,
		MediaType:  mediaType,
		MediaPath:  mediaPath,
		Caption:    text,
		PostedAt:   info.Timestamp.Unix(),
		ReceivedAt: now,
	}
	saved, err := t.db.InsertStory(t.ctx, s)
	if err != nil {
		slog.Error("tracker: insert story failed", "accountID", t.accountID, "storyID", info.ID, "err", err)
		return
	}
	if saved.ID == 0 {
		return // duplicate
	}
	slog.Info("tracker: story stored", "accountID", t.accountID, "contact", senderStr, "storyID", info.ID, "mediaType", mediaType)
	t.hub.Broadcast("story", map[string]any{
		"accountId": t.accountID,
		"contactId": *contactID,
		"storyId":   info.ID,
		"mediaType": mediaType,
		"postedAt":  info.Timestamp.Unix(),
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
	// WhatsApp wraps edited messages in a FutureProofMessage via GetEditedMessage().
	if em := msg.GetEditedMessage(); em != nil {
		if inner := extractText(em.GetMessage()); inner != "" {
			return inner
		}
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

// extractQuotedMessageID returns the StanzaID of the quoted (replied-to) message,
// or "" if this message is not a reply.
func extractQuotedMessageID(msg *waE2E.Message) string {
	if msg == nil {
		return ""
	}
	if ext := msg.GetExtendedTextMessage(); ext != nil {
		if ci := ext.GetContextInfo(); ci != nil {
			return ci.GetStanzaID()
		}
	}
	if img := msg.GetImageMessage(); img != nil {
		if ci := img.GetContextInfo(); ci != nil {
			return ci.GetStanzaID()
		}
	}
	if vid := msg.GetVideoMessage(); vid != nil {
		if ci := vid.GetContextInfo(); ci != nil {
			return ci.GetStanzaID()
		}
	}
	if aud := msg.GetAudioMessage(); aud != nil {
		if ci := aud.GetContextInfo(); ci != nil {
			return ci.GetStanzaID()
		}
	}
	if doc := msg.GetDocumentMessage(); doc != nil {
		if ci := doc.GetContextInfo(); ci != nil {
			return ci.GetStanzaID()
		}
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
			if t.checkBackoff() {
				slog.Debug("tracker: skipping resub — in rate-limit backoff", "accountID", t.accountID)
				continue
			}
			// Re-announce ourselves as available so WhatsApp knows to push events.
			if err := t.wa.SendAvailable(t.ctx); err != nil {
				slog.Warn("tracker: resub SendAvailable failed", "accountID", t.accountID, "err", err)
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

// ApplySchedule updates the in-memory schedule for this tracker.
// The schedule loop picks up the change on its next tick (≤1 min).
func (t *Tracker) ApplySchedule(forceOffline bool, slots []db.ScheduleSlot) {
	t.scheduleMu.Lock()
	t.forceOffline = forceOffline
	t.scheduleSlots = slots
	t.scheduleMu.Unlock()
	slog.Info("tracker: schedule updated", "accountID", t.accountID, "forceOffline", forceOffline, "slots", len(slots))
}

// runScheduleLoop checks every minute whether the connection should be up or down.
// Rules (evaluated in order):
//  1. forceOffline=true  → always disconnect
//  2. no slots defined   → always stay connected
//  3. slots defined      → connect only when the current time falls in a slot
func (t *Tracker) runScheduleLoop() {
	defer t.wg.Done()
	tick := time.NewTicker(time.Minute)
	defer tick.Stop()
	for {
		select {
		case <-t.ctx.Done():
			return
		case <-tick.C:
			t.applyScheduleNow()
		}
	}
}

func (t *Tracker) applyScheduleNow() {
	t.scheduleMu.RLock()
	forceOffline := t.forceOffline
	slots := t.scheduleSlots
	t.scheduleMu.RUnlock()

	shouldConnect := scheduleAllowsConnect(forceOffline, slots)
	connected := t.wa.IsConnected()

	switch {
	case shouldConnect && !connected:
		slog.Info("tracker: schedule: reconnecting", "accountID", t.accountID)
		if err := t.wa.Connect(t.ctx); err != nil {
			slog.Warn("tracker: schedule: reconnect failed", "accountID", t.accountID, "err", err)
		}
	case !shouldConnect && connected:
		slog.Info("tracker: schedule: disconnecting", "accountID", t.accountID, "forceOffline", forceOffline, "slots", len(slots))
		t.wa.SoftDisconnect()
	}
}

// scheduleAllowsConnect returns true if the connection should be active right now.
func scheduleAllowsConnect(forceOffline bool, slots []db.ScheduleSlot) bool {
	if forceOffline {
		return false
	}
	if len(slots) == 0 {
		return true
	}
	now := time.Now()
	minuteOfDay := now.Hour()*60 + now.Minute()
	for _, s := range slots {
		if slotContains(s.StartMin, s.EndMin, minuteOfDay) {
			return true
		}
	}
	return false
}

// slotContains reports whether minuteOfDay falls within [startMin, endMin).
// Overnight slots (startMin >= endMin) wrap around midnight.
func slotContains(startMin, endMin, minuteOfDay int) bool {
	if startMin < endMin {
		return minuteOfDay >= startMin && minuteOfDay < endMin
	}
	// Overnight: e.g. 22:00–06:00
	return minuteOfDay >= startMin || minuteOfDay < endMin
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
