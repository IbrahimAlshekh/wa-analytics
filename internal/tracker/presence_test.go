package tracker_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/tracker"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/testutil"
)

// newTestSetup creates a tracker seeded with one account, one contact.
func newTestSetup(t *testing.T, jid string) (tr *tracker.Tracker, hub *testutil.RecordingHub, store *db.DB, acc db.Account, contact db.Contact) {
	t.Helper()
	store = testutil.OpenTestDB(t)
	acc = testutil.SeedAccount(t, store)
	contact = testutil.SeedContact(t, store, acc.ID, jid)
	hub = testutil.NewRecordingHub()
	wa := &fakeWAClient{connected: true}
	tr = tracker.NewWithAccountID(acc.ID, tracker.Deps{
		WA:       wa,
		DB:       store,
		Hub:      hub,
		Interval: time.Minute,
	})
	return
}

func makePresence(jidStr string, unavailable bool) *events.Presence {
	jid, _ := types.ParseJID(jidStr)
	return &events.Presence{From: jid, Unavailable: unavailable}
}

func TestPresence_AvailableBroadcastsAndPersists(t *testing.T) {
	tr, hub, _, _, contact := newTestSetup(t, "14155550001@s.whatsapp.net")

	tr.HandleEvent(makePresence(contact.JID, false))

	evts := hub.EventsOfKind("presence")
	require.Len(t, evts, 1)
	payload := evts[0].Payload.(map[string]any)
	assert.Equal(t, "available", payload["state"])
	assert.Equal(t, contact.ID, payload["contactId"])
}

func TestPresence_DuplicateAvailableDeduped(t *testing.T) {
	tr, hub, _, _, contact := newTestSetup(t, "14155550001@s.whatsapp.net")

	tr.HandleEvent(makePresence(contact.JID, false))
	tr.HandleEvent(makePresence(contact.JID, false))

	assert.Len(t, hub.EventsOfKind("presence"), 1, "second available must be deduped")
}

func TestPresence_UnavailableAfterAvailable(t *testing.T) {
	tr, hub, _, _, contact := newTestSetup(t, "14155550001@s.whatsapp.net")

	tr.HandleEvent(makePresence(contact.JID, false))
	tr.HandleEvent(makePresence(contact.JID, true))

	evts := hub.EventsOfKind("presence")
	require.Len(t, evts, 2)
	assert.Equal(t, "available", evts[0].Payload.(map[string]any)["state"])
	assert.Equal(t, "unavailable", evts[1].Payload.(map[string]any)["state"])
}

func TestPresence_UnknownJIDDropped(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	hub := testutil.NewRecordingHub()
	tr := tracker.NewWithAccountID(acc.ID, tracker.Deps{
		WA:  &fakeWAClient{connected: true},
		DB:  store,
		Hub: hub,
	})

	tr.HandleEvent(makePresence("99999@s.whatsapp.net", false))
	assert.Empty(t, hub.EventsOfKind("presence"))
}

func TestPresence_InferredOfflineTimer(t *testing.T) {
	restore := tracker.SetInferredOfflineTimeout(60 * time.Millisecond)
	defer restore()

	tr, hub, _, _, contact := newTestSetup(t, "14155550001@s.whatsapp.net")

	// ChatPresence (typing) triggers inferred-online then schedules auto-offline.
	senderJID, _ := types.ParseJID(contact.JID)
	chatJID, _ := types.ParseJID(contact.JID)
	tr.HandleEvent(&events.ChatPresence{
		MessageSource: types.MessageSource{
			Chat:   chatJID,
			Sender: senderJID,
		},
		State: types.ChatPresenceComposing,
		Media: types.ChatPresenceMediaText,
	})

	// Should immediately infer online.
	evts := hub.EventsOfKind("presence")
	require.Len(t, evts, 1)
	assert.Equal(t, "available", evts[0].Payload.(map[string]any)["state"])

	// Wait for the inferred-offline timer to fire (up to 500 ms).
	ok := hub.WaitN("presence", 2, 500*time.Millisecond)
	require.True(t, ok, "inferred offline should fire after timeout")
	assert.Equal(t, "unavailable", hub.EventsOfKind("presence")[1].Payload.(map[string]any)["state"])
}

func TestPresence_RealPresenceCancelsInferredTimer(t *testing.T) {
	restore := tracker.SetInferredOfflineTimeout(100 * time.Millisecond)
	defer restore()

	tr, hub, _, _, contact := newTestSetup(t, "14155550001@s.whatsapp.net")

	// Infer online via typing.
	senderJID, _ := types.ParseJID(contact.JID)
	chatJID, _ := types.ParseJID(contact.JID)
	tr.HandleEvent(&events.ChatPresence{
		MessageSource: types.MessageSource{Chat: chatJID, Sender: senderJID},
		State:         types.ChatPresenceComposing,
		Media:         types.ChatPresenceMediaText,
	})
	require.Len(t, hub.EventsOfKind("presence"), 1)

	// Real "available" presence arrives before the timer fires — timer must cancel.
	// The presence is deduped (same state) but cancelInferredOffline is called first.
	tr.HandleEvent(makePresence(contact.JID, false))
	require.Len(t, hub.EventsOfKind("presence"), 1, "real available is deduped — no second event")

	// Wait longer than the inferred-offline timeout; no offline event should fire.
	time.Sleep(200 * time.Millisecond)
	assert.Len(t, hub.EventsOfKind("presence"), 1, "timer must have been cancelled by real presence")
}

func TestManager_AddIdempotent(t *testing.T) {
	store := testutil.OpenTestDB(t)
	hub := testutil.NewRecordingHub()
	deps := tracker.Deps{WA: &fakeWAClient{}, DB: store, Hub: hub, Interval: time.Minute}

	mgr := tracker.NewTrackerManager()
	t1 := mgr.Add(1, deps)
	t2 := mgr.Add(1, deps)
	assert.Same(t, t1, t2)
}

func TestManager_RemoveStops(t *testing.T) {
	store := testutil.OpenTestDB(t)
	hub := testutil.NewRecordingHub()
	deps := tracker.Deps{WA: &fakeWAClient{}, DB: store, Hub: hub, Interval: time.Minute}

	mgr := tracker.NewTrackerManager()
	mgr.Add(1, deps)
	mgr.Remove(1)
	assert.Nil(t, mgr.Get(1))
}

func TestManager_StopAllSafe(t *testing.T) {
	store := testutil.OpenTestDB(t)
	hub := testutil.NewRecordingHub()
	deps := tracker.Deps{WA: &fakeWAClient{}, DB: store, Hub: hub, Interval: time.Minute}

	mgr := tracker.NewTrackerManager()
	for i := int64(1); i <= 5; i++ {
		mgr.Add(i, deps)
	}
	mgr.StopAll() // must not panic
}

func TestManager_ConcurrentAdd(t *testing.T) {
	store := testutil.OpenTestDB(t)
	hub := testutil.NewRecordingHub()
	deps := tracker.Deps{WA: &fakeWAClient{}, DB: store, Hub: hub, Interval: time.Minute}

	mgr := tracker.NewTrackerManager()
	done := make(chan struct{}, 20)
	for i := range 20 {
		i := i
		go func() {
			mgr.Add(int64(i%5), deps)
			done <- struct{}{}
		}()
	}
	for range 20 {
		<-done
	}
}

func TestHandleEvent_ConnectedBroadcasts(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	hub := testutil.NewRecordingHub()
	tr := tracker.NewWithAccountID(acc.ID, tracker.Deps{
		WA:       &fakeWAClient{connected: true},
		DB:       store,
		Hub:      hub,
		Interval: time.Minute,
	})

	tr.HandleEvent(&events.Connected{})
	assert.Len(t, hub.EventsOfKind("auth.linked"), 1)
}
