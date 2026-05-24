package testutil

import (
	"sync"
	"time"
)

// Broadcast is a single event recorded by RecordingHub.
type Broadcast struct {
	Kind    string
	Payload any
}

// RecordingHub implements both tracker.Hub and api.Hub interfaces (same signature).
// Tests can inspect emitted broadcasts without starting a real WebSocket server.
type RecordingHub struct {
	mu     sync.Mutex
	events []Broadcast
	notify chan struct{}
}

func NewRecordingHub() *RecordingHub {
	return &RecordingHub{notify: make(chan struct{}, 64)}
}

// Broadcast records an event (satisfies tracker.Hub and api.Hub).
func (h *RecordingHub) Broadcast(kind string, payload any) {
	h.mu.Lock()
	h.events = append(h.events, Broadcast{Kind: kind, Payload: payload})
	h.mu.Unlock()
	select {
	case h.notify <- struct{}{}:
	default:
	}
}

// Events returns a snapshot of all recorded broadcasts.
func (h *RecordingHub) Events() []Broadcast {
	h.mu.Lock()
	defer h.mu.Unlock()
	cp := make([]Broadcast, len(h.events))
	copy(cp, h.events)
	return cp
}

// EventsOfKind returns all broadcasts of a given kind.
func (h *RecordingHub) EventsOfKind(kind string) []Broadcast {
	h.mu.Lock()
	defer h.mu.Unlock()
	var out []Broadcast
	for _, e := range h.events {
		if e.Kind == kind {
			out = append(out, e)
		}
	}
	return out
}

// Wait blocks until at least one event of kind is recorded or timeout expires.
// Returns true if the event arrived.
func (h *RecordingHub) Wait(kind string, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for {
		h.mu.Lock()
		for _, e := range h.events {
			if e.Kind == kind {
				h.mu.Unlock()
				return true
			}
		}
		h.mu.Unlock()

		remaining := time.Until(deadline)
		if remaining <= 0 {
			return false
		}
		timer := time.NewTimer(remaining)
		select {
		case <-h.notify:
			timer.Stop()
		case <-timer.C:
			return false
		}
	}
}

// WaitN blocks until at least n events of kind exist, or timeout expires.
func (h *RecordingHub) WaitN(kind string, n int, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for {
		h.mu.Lock()
		count := 0
		for _, e := range h.events {
			if e.Kind == kind {
				count++
			}
		}
		h.mu.Unlock()
		if count >= n {
			return true
		}

		remaining := time.Until(deadline)
		if remaining <= 0 {
			return false
		}
		timer := time.NewTimer(remaining)
		select {
		case <-h.notify:
			timer.Stop()
		case <-timer.C:
			return false
		}
	}
}

// Reset clears all recorded events.
func (h *RecordingHub) Reset() {
	h.mu.Lock()
	h.events = h.events[:0]
	h.mu.Unlock()
}
