package db_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/testutil"
)

// ---- Accounts ---------------------------------------------------------------

func TestAccount_InsertGet(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc, err := store.InsertAccount(t.Context(), "123@s.whatsapp.net", "My Account")
	require.NoError(t, err)
	assert.Greater(t, acc.ID, int64(0))
	assert.Equal(t, "123@s.whatsapp.net", acc.JID)
	assert.Equal(t, "My Account", acc.Label)
	assert.True(t, acc.TrackingActive)
}

func TestAccount_InsertConflictUpdatesLabel(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc1, err := store.InsertAccount(t.Context(), "123@s.whatsapp.net", "First")
	require.NoError(t, err)
	acc2, err := store.InsertAccount(t.Context(), "123@s.whatsapp.net", "Second")
	require.NoError(t, err)
	assert.Equal(t, acc1.ID, acc2.ID, "same row on conflict")
	assert.Equal(t, "Second", acc2.Label)
}

func TestAccount_List(t *testing.T) {
	store := testutil.OpenTestDB(t)
	_, err := store.InsertAccount(t.Context(), "a@s.whatsapp.net", "A")
	require.NoError(t, err)
	_, err = store.InsertAccount(t.Context(), "b@s.whatsapp.net", "B")
	require.NoError(t, err)

	list, err := store.ListAccounts(t.Context())
	require.NoError(t, err)
	assert.Len(t, list, 2)
}

func TestAccount_UpdateDelete(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)

	label := "New Label"
	require.NoError(t, store.UpdateAccount(t.Context(), acc.ID, &label, nil))
	got, err := store.GetAccount(t.Context(), acc.ID)
	require.NoError(t, err)
	assert.Equal(t, "New Label", got.Label)

	require.NoError(t, store.DeleteAccount(t.Context(), acc.ID))
	_, err = store.GetAccount(t.Context(), acc.ID)
	assert.Error(t, err)
}

// ---- Contacts ---------------------------------------------------------------

func TestContact_InsertGet(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact, err := store.InsertContact(t.Context(), acc.ID, "999@s.whatsapp.net", "9991234567", "Alice")
	require.NoError(t, err)
	assert.Greater(t, contact.ID, int64(0))
	assert.Equal(t, "999@s.whatsapp.net", contact.JID)
	assert.Equal(t, "Alice", contact.DisplayName)
}

func TestContact_CountAndList(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	testutil.SeedContact(t, store, acc.ID, "1@s.whatsapp.net")
	testutil.SeedContact(t, store, acc.ID, "2@s.whatsapp.net")

	count, err := store.CountContacts(t.Context(), acc.ID)
	require.NoError(t, err)
	assert.Equal(t, 2, count)

	contacts, err := store.ListContacts(t.Context(), acc.ID, 10, 0)
	require.NoError(t, err)
	assert.Len(t, contacts, 2)
}

func TestContact_UpdateDelete(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	name := "Updated Name"
	require.NoError(t, store.UpdateContact(t.Context(), contact.ID, &name, nil))
	got, err := store.GetContact(t.Context(), acc.ID, contact.ID)
	require.NoError(t, err)
	assert.Equal(t, "Updated Name", got.DisplayName)

	require.NoError(t, store.DeleteContact(t.Context(), contact.ID))
	_, err = store.GetContact(t.Context(), acc.ID, contact.ID)
	assert.Error(t, err)
}

func TestContact_ListOrdering(t *testing.T) {
	// Tracked contacts should appear before untracked ones.
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)

	// Insert two contacts: first untracked, then tracked.
	c1 := testutil.SeedContact(t, store, acc.ID, "untracked@s.whatsapp.net")
	trackingOff := false
	require.NoError(t, store.UpdateContact(t.Context(), c1.ID, nil, &trackingOff))

	c2 := testutil.SeedContact(t, store, acc.ID, "tracked@s.whatsapp.net")
	_ = c2

	contacts, err := store.ListContacts(t.Context(), acc.ID, 10, 0)
	require.NoError(t, err)
	require.Len(t, contacts, 2)
	assert.True(t, contacts[0].TrackingEnabled, "tracked contact first")
}

// ---- Presence ---------------------------------------------------------------

func TestPresence_InsertLatest(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	t1 := time.Now().Add(-10 * time.Minute)
	t2 := time.Now()

	testutil.SeedPresence(t, store, contact.ID, "available", t1)
	testutil.SeedPresence(t, store, contact.ID, "unavailable", t2)

	latest, err := store.LatestPresence(t.Context(), contact.ID)
	require.NoError(t, err)
	assert.Equal(t, "unavailable", latest.State)
	assert.Equal(t, t2.Unix(), latest.ObservedAt)
}

func TestPresence_LatestEmpty(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	latest, err := store.LatestPresence(t.Context(), contact.ID)
	require.NoError(t, err)
	assert.Zero(t, latest.ID, "no rows → zero value")
}

// ---- Messages ---------------------------------------------------------------

func TestMessage_InsertList(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	now := time.Now()
	m1 := testutil.SeedMessage(t, store, acc.ID, contact.ID, "hello", now.Add(-2*time.Minute))
	m2 := testutil.SeedMessage(t, store, acc.ID, contact.ID, "world", now)

	msgs, err := store.ListMessages(t.Context(), contact.ID, 0, 50)
	require.NoError(t, err)
	require.Len(t, msgs, 2)
	// Should be newest-first.
	assert.Equal(t, m2.ID, msgs[0].ID)
	assert.Equal(t, m1.ID, msgs[1].ID)
}

func TestMessage_InsertDuplicate(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")
	cid := contact.ID

	msg := db.Message{
		AccountID: acc.ID, ContactID: &cid,
		ChatJID: "c@s.whatsapp.net", SenderJID: "c@s.whatsapp.net",
		MessageID: "unique-msg-id",
		Text:      "hi",
		Timestamp: time.Now().Unix(),
	}
	m1, err := store.InsertMessage(t.Context(), msg)
	require.NoError(t, err)
	assert.NotZero(t, m1.ID)

	// Same MessageID — should be ignored (INSERT OR IGNORE).
	m2, err := store.InsertMessage(t.Context(), msg)
	require.NoError(t, err)
	assert.Zero(t, m2.ID, "duplicate returns zero-value Message")
}

func TestMessage_GetOldest(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")
	now := time.Now()

	oldest := testutil.SeedMessage(t, store, acc.ID, contact.ID, "oldest", now.Add(-1*time.Hour))
	testutil.SeedMessage(t, store, acc.ID, contact.ID, "newest", now)

	got, err := store.GetOldestContactMessage(t.Context(), acc.ID, contact.ID)
	require.NoError(t, err)
	assert.Equal(t, oldest.ID, got.ID)
}

// ---- Users ------------------------------------------------------------------

func TestUser_UpsertGetDelete(t *testing.T) {
	store := testutil.OpenTestDB(t)

	require.NoError(t, store.UpsertUser(t.Context(), "admin", "hash123"))
	user, err := store.GetUser(t.Context(), "admin")
	require.NoError(t, err)
	assert.Equal(t, "admin", user.Username)
	assert.Equal(t, "hash123", user.PasswordHash)

	// Upsert again (update password).
	require.NoError(t, store.UpsertUser(t.Context(), "admin", "newhash"))
	user2, err := store.GetUser(t.Context(), "admin")
	require.NoError(t, err)
	assert.Equal(t, "newhash", user2.PasswordHash)

	require.NoError(t, store.DeleteUser(t.Context(), "admin"))
	_, err = store.GetUser(t.Context(), "admin")
	assert.Error(t, err)
}

func TestUser_HasUsers(t *testing.T) {
	store := testutil.OpenTestDB(t)
	has, err := store.HasUsers(t.Context())
	require.NoError(t, err)
	assert.False(t, has)

	require.NoError(t, store.UpsertUser(t.Context(), "admin", "hash"))
	has, err = store.HasUsers(t.Context())
	require.NoError(t, err)
	assert.True(t, has)
}

// ---- Timeline ---------------------------------------------------------------

func TestTimeline_MixedEvents(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	base := time.Now()
	testutil.SeedPresence(t, store, contact.ID, "available", base.Add(-5*time.Minute))
	testutil.SeedMessage(t, store, acc.ID, contact.ID, "hi", base.Add(-3*time.Minute))
	testutil.SeedPresence(t, store, contact.ID, "unavailable", base)

	entries, err := store.Timeline(t.Context(), contact.ID, 0)
	require.NoError(t, err)
	assert.Greater(t, len(entries), 0)
}
