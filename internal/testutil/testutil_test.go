package testutil_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/testutil"
)

// ---- OpenTestDB -------------------------------------------------------------

func TestOpenTestDB_Migrations(t *testing.T) {
	store := testutil.OpenTestDB(t)
	// Verify the migrations table was populated.
	var count int
	err := store.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&count)
	require.NoError(t, err)
	assert.Greater(t, count, 0, "at least one migration should have run")
}

func TestOpenTestDB_Isolation(t *testing.T) {
	// Two calls must return independent databases (separate cache names).
	s1 := testutil.OpenTestDB(t)
	s2 := testutil.OpenTestDB(t)

	acc1 := testutil.SeedAccount(t, s1)

	// acc1 is not visible in s2.
	_, err := s2.GetAccount(t.Context(), acc1.ID)
	assert.Error(t, err, "accounts from s1 must not appear in s2")
}

// ---- RecordingHub -----------------------------------------------------------

func TestRecordingHub_Broadcast(t *testing.T) {
	h := testutil.NewRecordingHub()
	h.Broadcast("presence", map[string]any{"state": "available"})
	h.Broadcast("picture", nil)

	evs := h.Events()
	require.Len(t, evs, 2)
	assert.Equal(t, "presence", evs[0].Kind)
	assert.Equal(t, "picture", evs[1].Kind)
}

func TestRecordingHub_Wait(t *testing.T) {
	h := testutil.NewRecordingHub()

	go func() {
		time.Sleep(20 * time.Millisecond)
		h.Broadcast("ping", nil)
	}()

	assert.True(t, h.Wait("ping", 500*time.Millisecond))
	assert.False(t, h.Wait("nope", 50*time.Millisecond))
}

func TestRecordingHub_EventsOfKind(t *testing.T) {
	h := testutil.NewRecordingHub()
	h.Broadcast("a", nil)
	h.Broadcast("b", nil)
	h.Broadcast("a", nil)

	assert.Len(t, h.EventsOfKind("a"), 2)
	assert.Len(t, h.EventsOfKind("b"), 1)
	assert.Len(t, h.EventsOfKind("c"), 0)
}

func TestRecordingHub_Reset(t *testing.T) {
	h := testutil.NewRecordingHub()
	h.Broadcast("x", nil)
	h.Reset()
	assert.Empty(t, h.Events())
}

// ---- Seed helpers -----------------------------------------------------------

func TestSeedAccount(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	assert.Greater(t, acc.ID, int64(0))
}

func TestSeedContact(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")
	assert.Greater(t, contact.ID, int64(0))
}

func TestSeedPresence(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")
	ev := testutil.SeedPresence(t, store, contact.ID, "available", time.Now())
	assert.Greater(t, ev.ID, int64(0))
}

func TestSeedMessage(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")
	msg := testutil.SeedMessage(t, store, acc.ID, contact.ID, "hello", time.Now())
	assert.Greater(t, msg.ID, int64(0))
}

// ---- JWT helpers ------------------------------------------------------------

func TestTestJWT(t *testing.T) {
	key := testutil.TestJWTKey(t)
	token := testutil.TestJWT(t, key, "alice")
	assert.NotEmpty(t, token)
}
