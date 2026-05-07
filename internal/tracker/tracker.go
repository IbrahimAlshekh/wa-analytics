package tracker

import (
	"context"
	"encoding/hex"
	"log"
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
	t.cancel()
	t.wg.Wait()
}

// HandleEvent is the single entry point for whatsmeow events. Wired into wa.Client.AttachHandler.
func (t *Tracker) HandleEvent(evt any) {
	switch v := evt.(type) {
	case *events.Connected:
		log.Printf("tracker: connected as %s", t.wa.OwnJID())
		t.hub.Broadcast("auth.linked", map[string]any{"ownJID": t.wa.OwnJID()})
		t.onConnected()

	case *events.Disconnected:
		log.Printf("tracker: disconnected")

	case *events.LoggedOut:
		log.Printf("tracker: logged out (reason=%v)", v.Reason)
		t.hub.Broadcast("auth.logout", map[string]any{"reason": v.Reason.String()})
		t.stopWorkers()

	case *events.PairSuccess:
		log.Printf("tracker: pair success jid=%s", v.ID.String())

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

	t.wg.Add(4)
	go t.runPictureLoop()
	go t.runAboutLoop()
	go t.runResubLoop()
	go func() {
		defer t.wg.Done()
		t.startSubscriptions()
	}()

	if err := t.wa.SendAvailable(t.ctx); err != nil {
		log.Printf("tracker: send available: %v", err)
	}
}

func (t *Tracker) stopWorkers() {
	t.mu.Lock()
	t.running = false
	t.mu.Unlock()
}

func (t *Tracker) startSubscriptions() {
	contacts, err := t.db.ListTrackedContacts(t.ctx)
	if err != nil {
		log.Printf("tracker: list contacts: %v", err)
		return
	}
	for _, c := range contacts {
		jid, err := types.ParseJID(c.JID)
		if err != nil {
			log.Printf("tracker: parse jid %s: %v", c.JID, err)
			continue
		}
		if err := t.wa.SubscribePresence(t.ctx, jid); err != nil {
			log.Printf("tracker: subscribe %s: %v", c.JID, err)
		}
	}
}

// SubscribeContact lets the API tell us about a freshly added contact.
func (t *Tracker) SubscribeContact(ctx context.Context, c db.Contact) {
	if !t.wa.IsConnected() || !c.TrackingEnabled {
		return
	}
	jid, err := types.ParseJID(c.JID)
	if err != nil {
		log.Printf("tracker: parse jid %s: %v", c.JID, err)
		return
	}
	if err := t.wa.SubscribePresence(ctx, jid); err != nil {
		log.Printf("tracker: subscribe %s: %v", c.JID, err)
	}
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
		return // collapse identical re-emits
	}

	ev, err := t.db.InsertPresence(t.ctx, c.ID, state, lastSeen, now)
	if err != nil {
		log.Printf("tracker: insert presence: %v", err)
		return
	}

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
