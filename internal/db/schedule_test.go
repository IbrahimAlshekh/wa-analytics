package db_test

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/testutil"
)

func TestSchedule_GetEmpty(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)

	forceOffline, slots, err := store.GetAccountSchedule(t.Context(), acc.ID)
	require.NoError(t, err)
	assert.False(t, forceOffline)
	assert.Empty(t, slots)
}

func TestSchedule_SetGet(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)

	newSlots := []db.ScheduleSlot{
		{StartMin: 540, EndMin: 600},
		{StartMin: 720, EndMin: 840},
	}
	require.NoError(t, store.SetAccountSchedule(t.Context(), acc.ID, true, newSlots))

	forceOffline, slots, err := store.GetAccountSchedule(t.Context(), acc.ID)
	require.NoError(t, err)
	assert.True(t, forceOffline)
	require.Len(t, slots, 2)
	assert.Equal(t, 540, slots[0].StartMin)
	assert.Equal(t, 720, slots[1].StartMin)
}

func TestSchedule_SetReplacesExisting(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)

	// Set 3 slots.
	require.NoError(t, store.SetAccountSchedule(t.Context(), acc.ID, false, []db.ScheduleSlot{
		{StartMin: 0, EndMin: 60},
		{StartMin: 60, EndMin: 120},
		{StartMin: 120, EndMin: 180},
	}))

	// Replace with 1 slot.
	require.NoError(t, store.SetAccountSchedule(t.Context(), acc.ID, false, []db.ScheduleSlot{
		{StartMin: 200, EndMin: 300},
	}))

	_, slots, err := store.GetAccountSchedule(t.Context(), acc.ID)
	require.NoError(t, err)
	assert.Len(t, slots, 1, "Set should atomically replace all slots")
	assert.Equal(t, 200, slots[0].StartMin)
}

func TestSchedule_SetEmpty(t *testing.T) {
	store := testutil.OpenTestDB(t)
	acc := testutil.SeedAccount(t, store)

	// First set some slots.
	require.NoError(t, store.SetAccountSchedule(t.Context(), acc.ID, true, []db.ScheduleSlot{{StartMin: 0, EndMin: 60}}))

	// Now clear all slots.
	require.NoError(t, store.SetAccountSchedule(t.Context(), acc.ID, false, nil))
	_, slots, err := store.GetAccountSchedule(t.Context(), acc.ID)
	require.NoError(t, err)
	assert.Empty(t, slots)
}
