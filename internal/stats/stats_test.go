package stats_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/stats"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/testutil"
)

// fixed "now" in UTC so day boundaries are stable.
var testNow = time.Date(2025, 6, 10, 18, 0, 0, 0, time.UTC)

func TestCompute_NoEvents(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	s, err := stats.Compute(context.Background(), store, contact.ID, "today", testNow)
	require.NoError(t, err)
	assert.Equal(t, "today", s.Range)
	assert.Zero(t, s.OnlineSecondsAll)
	assert.Zero(t, s.PictureChanges)
	assert.Zero(t, s.AboutChanges)
	assert.NotEmpty(t, s.Days, "today range produces at least 1 day bucket")
	for _, d := range s.Days {
		assert.Zero(t, d.OnlineSeconds)
	}
}

func TestCompute_FullyOnlineToday(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	startOfDay := time.Date(testNow.Year(), testNow.Month(), testNow.Day(), 0, 0, 0, 0, testNow.Location())

	// Contact came online at midnight, still online at testNow.
	testutil.SeedPresence(t, store, contact.ID, "available", startOfDay)

	s, err := stats.Compute(context.Background(), store, contact.ID, "today", testNow)
	require.NoError(t, err)

	// Online seconds should be roughly from startOfDay to testNow (18h = 64800s).
	expected := testNow.Unix() - startOfDay.Unix()
	assert.Equal(t, expected, s.OnlineSecondsAll)
}

func TestCompute_OfflineWholeDay(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	// Only unavailable events.
	startOfDay := time.Date(testNow.Year(), testNow.Month(), testNow.Day(), 0, 0, 0, 0, testNow.Location())
	testutil.SeedPresence(t, store, contact.ID, "unavailable", startOfDay)

	s, err := stats.Compute(context.Background(), store, contact.ID, "today", testNow)
	require.NoError(t, err)
	assert.Zero(t, s.OnlineSecondsAll)
}

func TestCompute_OnOffSession(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	base := time.Date(testNow.Year(), testNow.Month(), testNow.Day(), 10, 0, 0, 0, testNow.Location())
	// Online at 10:00, offline at 10:30 → 1800 seconds online.
	testutil.SeedPresence(t, store, contact.ID, "available", base)
	testutil.SeedPresence(t, store, contact.ID, "unavailable", base.Add(30*time.Minute))

	s, err := stats.Compute(context.Background(), store, contact.ID, "today", testNow)
	require.NoError(t, err)
	assert.Equal(t, int64(1800), s.OnlineSecondsAll)
}

func TestCompute_PriorStateSeeded(t *testing.T) {
	// If the last event BEFORE the range says "available", the range starts counting online.
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	startOfDay := time.Date(testNow.Year(), testNow.Month(), testNow.Day(), 0, 0, 0, 0, testNow.Location())
	// Online event happened yesterday (before range start).
	yesterday := startOfDay.Add(-1 * time.Hour)
	testutil.SeedPresence(t, store, contact.ID, "available", yesterday)
	// Goes offline at 09:00 today.
	offline := startOfDay.Add(9 * time.Hour)
	testutil.SeedPresence(t, store, contact.ID, "unavailable", offline)

	s, err := stats.Compute(context.Background(), store, contact.ID, "today", testNow)
	require.NoError(t, err)
	// Should count 9 hours (midnight→09:00) from prior-state seeding.
	assert.Equal(t, int64(9*3600), s.OnlineSecondsAll)
}

func TestCompute_WeekRange(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	s, err := stats.Compute(context.Background(), store, contact.ID, "week", testNow)
	require.NoError(t, err)
	assert.Equal(t, "week", s.Range)
	assert.Len(t, s.Days, 7)
}

func TestCompute_MonthRange(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	s, err := stats.Compute(context.Background(), store, contact.ID, "month", testNow)
	require.NoError(t, err)
	assert.Equal(t, "month", s.Range)
	assert.Len(t, s.Days, 30)
}

func TestCompute_UnknownRange(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	_, err := stats.Compute(context.Background(), store, contact.ID, "badrange", testNow)
	assert.Error(t, err)
}
