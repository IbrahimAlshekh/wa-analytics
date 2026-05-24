package tracker

import (
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

// ---- slotContains -----------------------------------------------------------

func TestSlotContains(t *testing.T) {
	tests := []struct {
		name       string
		start, end int
		minute     int
		want       bool
	}{
		// Normal (non-overnight) slots
		{"within slot", 540, 600, 570, true},          // 09:00–10:00, at 09:30
		{"at start (inclusive)", 540, 600, 540, true},
		{"before start", 540, 600, 539, false},
		{"at end (exclusive)", 540, 600, 600, false},
		{"after end", 540, 600, 601, false},

		// Overnight wrap-around (e.g. 22:00–06:00)
		{"overnight: late night", 1320, 360, 1350, true},   // at 22:30
		{"overnight: early morning", 1320, 360, 30, true},  // at 00:30
		{"overnight: midday outside", 1320, 360, 720, false},
		{"overnight: exactly midnight", 1320, 360, 0, true},
		{"overnight: at end (exclusive)", 1320, 360, 360, false},

		// Edge cases
		{"all day", 0, 1440, 720, true},
		{"zero slot midnight start", 0, 60, 30, true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, slotContains(tc.start, tc.end, tc.minute))
		})
	}
}

// ---- scheduleAllowsConnect --------------------------------------------------

func slot(start, end int) db.ScheduleSlot {
	return db.ScheduleSlot{StartMin: start, EndMin: end}
}

func TestScheduleAllowsConnect_ForceOffline(t *testing.T) {
	assert.False(t, scheduleAllowsConnect(true, nil))
	assert.False(t, scheduleAllowsConnect(true, []db.ScheduleSlot{slot(0, 1440)}))
}

func TestScheduleAllowsConnect_NoSlots(t *testing.T) {
	assert.True(t, scheduleAllowsConnect(false, nil))
	assert.True(t, scheduleAllowsConnect(false, []db.ScheduleSlot{}))
}

func TestScheduleAllowsConnect_SlotPresent(t *testing.T) {
	// With an all-day slot (0–1440) it must always return true regardless of clock.
	assert.True(t, scheduleAllowsConnect(false, []db.ScheduleSlot{slot(0, 1440)}))
}

// ---- equalIntPtr ------------------------------------------------------------

func TestEqualIntPtr(t *testing.T) {
	n1, n2, n3 := int64(42), int64(42), int64(99)
	assert.True(t, equalIntPtr(nil, nil))
	assert.False(t, equalIntPtr(&n1, nil))
	assert.False(t, equalIntPtr(nil, &n1))
	assert.True(t, equalIntPtr(&n1, &n2))
	assert.False(t, equalIntPtr(&n1, &n3))
}

// ---- bytesHex ---------------------------------------------------------------

func TestBytesHex(t *testing.T) {
	assert.Equal(t, "", bytesHex(nil))
	assert.Equal(t, "", bytesHex([]byte{}))
	assert.Equal(t, "deadbeef", bytesHex([]byte{0xde, 0xad, 0xbe, 0xef}))
}

// ---- isRateLimit / isExpectedErr --------------------------------------------

func TestIsRateLimit(t *testing.T) {
	assert.False(t, isRateLimit(nil))

	for _, msg := range []string{"rate limit exceeded", "too many requests", "got 429", "backoff required", "blocked by server"} {
		assert.True(t, isRateLimit(fmt.Errorf("%s", msg)), "expected rate-limit for %q", msg)
	}
	assert.False(t, isRateLimit(fmt.Errorf("some other error")))
}

func TestIsExpectedErr(t *testing.T) {
	assert.True(t, isExpectedErr(nil))
	assert.True(t, isExpectedErr(errors.New("profile picture not set")))
	assert.True(t, isExpectedErr(errors.New("not found")))
	assert.True(t, isExpectedErr(errors.New("no picture available")))
	assert.True(t, isExpectedErr(errors.New("404 response")))
	assert.True(t, isExpectedErr(errors.New("no status")))
	assert.True(t, isExpectedErr(errors.New("forbidden")))
	assert.False(t, isExpectedErr(errors.New("unexpected failure")))
}
