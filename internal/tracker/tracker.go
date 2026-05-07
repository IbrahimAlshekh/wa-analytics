package tracker

import (
	"context"
	"encoding/hex"
	"log/slog"
	"sync"
	"time"

	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/wa"
)

// Hub is the minimum interface the tracker uses to broadcast updates.
type Hub interface {
	Broadcast(kind string, payload any)
}

type Deps struct {
	WA       *wa.Client
	DB       *db.DB
	Hub      Hub
	Interval time.Duration
}

type Tracker struct {
	wa       *wa.Client
	db       *db.DB
	hub      Hub
	interval time.Duration

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	mu      sync.Mutex
	running bool
}

func New(d Deps) *Tracker {
	ctx, cancel := context.WithCancel(context.Background())
	return &Tracker{
		wa:       d.WA,
		db:       d.DB,
		hub:      d.Hub,
		interval: d.Interval,
		ctx:      ctx,
		cancel:   cancel,
	}
}

func (t *Tracker) Stop() {
	slog.Info("tracker: stopping")
	t.cancel()
	t.wg.Wait()
	slog.Info("tracker: stopped")
}

// HandleEvent is the single entry point for whatsmeow events. Wired into wa.Client.AttachHandler.
func (t *Tracker) HandleEvent(evt any) {
	switch v := evt.(type) {
	case *events.Connected:
		slog.Info("tracker: connected", "jid", t.wa.OwnJID())
		t.hub.Broadcast("auth.linked", map[string]any{"ownJID": t.wa.OwnJID()})
		t.onConnected()

	case *events.Disconnected:
		slog.Warn("tracker: disconnected")

	case *events.LoggedOut:
		slog.Warn("tracker: logged out", "reason", v.Reason.String())
		t.hub.Broadcast("auth.logout", map[string]any{"reason": v.Reason.String()})
		t.stopWorkers()

	case *events.PairSuccess:
		slog.Info("tracker: pair success", "jid", v.ID.String())

	case *events.Presence:
		t.onPresence(v)
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

	slog.Info("tracker: starting workers", "poll_interval", t.interval)
	t.wg.Add(4)
	go t.runPictureLoop()
	go t.runAboutLoop()
	go t.runResubLoop()
	go func() {
		defer t.wg.Done()
		t.startSubscriptions()
	}()

	if err := t.wa.SendAvailable(t.ctx); err != nil {
		slog.Warn("tracker: send available failed", "err", err)
	}
}

func (t *Tracker) stopWorkers() {
	t.mu.Lock()
	t.running = false
	t.mu.Unlock()
	slog.Info("tracker: workers stopped")
}

func (t *Tracker) startSubscriptions() {
	contacts, err := t.db.ListTrackedContacts(t.ctx)
	if err != nil {
		slog.Error("tracker: list contacts for subscription", "err", err)
		return
	}
	slog.Info("tracker: subscribing to presence", "count", len(contacts))
	failed := 0
	for _, c := range contacts {
		jid, err := types.ParseJID(c.JID)
		if err != nil {
			slog.Error("tracker: invalid jid", "jid", c.JID, "err", err)
			failed++
			continue
		}
		if err := t.wa.SubscribePresence(t.ctx, jid); err != nil {
			slog.Warn("tracker: subscribe presence failed", "jid", c.JID, "err", err)
			failed++
		}
	}
	if failed > 0 {
		slog.Warn("tracker: some subscriptions failed", "failed", failed, "total", len(contacts))
	}
}

// SubscribeContact lets the API tell us about a freshly added contact.
func (t *Tracker) SubscribeContact(ctx context.Context, c db.Contact) {
	if !t.wa.IsConnected() || !c.TrackingEnabled {
		slog.Debug("tracker: skip subscribe (not connected or tracking disabled)", "jid", c.JID, "connected", t.wa.IsConnected(), "tracking", c.TrackingEnabled)
		return
	}
	jid, err := types.ParseJID(c.JID)
	if err != nil {
		slog.Error("tracker: invalid jid for subscribe", "jid", c.JID, "err", err)
		return
	}
	if err := t.wa.SubscribePresence(ctx, jid); err != nil {
		slog.Warn("tracker: subscribe presence failed", "jid", c.JID, "err", err)
		return
	}
	slog.Info("tracker: subscribed to presence", "jid", c.JID)
}

// onPresence persists a presence event (deduping flips of the same state) and broadcasts.
func (t *Tracker) onPresence(p *events.Presence) {
	jidStr := p.From.ToNonAD().String()
	c, err := t.db.GetContactByJID(t.ctx, jidStr)
	if err != nil {
		// Not tracked — drop.
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
		slog.Debug("tracker: presence unchanged, skipping", "jid", jidStr, "state", state)
		return // collapse identical re-emits
	}

	ev, err := t.db.InsertPresence(t.ctx, c.ID, state, lastSeen, now)
	if err != nil {
		slog.Error("tracker: insert presence failed", "jid", jidStr, "contact_id", c.ID, "err", err)
		return
	}

	slog.Info("tracker: presence update", "jid", jidStr, "contact_id", c.ID, "state", state, "observed_at", ev.ObservedAt)
	t.hub.Broadcast("presence", map[string]any{
		"contactId":  c.ID,
		"jid":        c.JID,
		"state":      state,
		"lastSeen":   lastSeen,
		"observedAt": ev.ObservedAt,
	})
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
			slog.Debug("tracker: re-subscribing to presence")
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
