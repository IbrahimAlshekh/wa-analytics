package analytics_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/analytics"
)

// ---- meanF ------------------------------------------------------------------

func TestMeanF(t *testing.T) {
	assert.Equal(t, 0.0, analytics.MeanF(nil))
	assert.Equal(t, 0.0, analytics.MeanF([]int64{}))
	assert.Equal(t, 5.0, analytics.MeanF([]int64{5}))
	assert.Equal(t, 2.5, analytics.MeanF([]int64{1, 2, 3, 4}))
}

// ---- medianF ----------------------------------------------------------------

func TestMedianF_Odd(t *testing.T) {
	assert.Equal(t, 3.0, analytics.MedianF([]int64{5, 3, 1}))
}

func TestMedianF_Even(t *testing.T) {
	assert.Equal(t, 2.5, analytics.MedianF([]int64{1, 2, 3, 4}))
}

func TestMedianF_Empty(t *testing.T) {
	assert.Equal(t, 0.0, analytics.MedianF(nil))
}

func TestMedianF_Single(t *testing.T) {
	assert.Equal(t, 7.0, analytics.MedianF([]int64{7}))
}

// ---- safeDivF ---------------------------------------------------------------

func TestSafeDivF(t *testing.T) {
	assert.Equal(t, 0.0, analytics.SafeDivF(10, 0))
	assert.Equal(t, 2.0, analytics.SafeDivF(10, 5))
}

// ---- pct --------------------------------------------------------------------

func TestPct(t *testing.T) {
	assert.Equal(t, 0.0, analytics.Pct(5, 0))
	assert.Equal(t, 50.0, analytics.Pct(1, 2))
	assert.Equal(t, 100.0, analytics.Pct(5, 5))
}

// ---- rangeBounds ------------------------------------------------------------

func TestRangeBounds_Day(t *testing.T) {
	now := time.Now()
	startDay, _, startUnix, endUnix := analytics.RangeBounds("day", now)
	// startDay must be today in local time.
	today := time.Now().Format("2006-01-02")
	assert.Equal(t, today, startDay)
	// startUnix is midnight today (< now).
	assert.LessOrEqual(t, startUnix, endUnix)
	assert.Equal(t, now.Unix(), endUnix)
}

func TestRangeBounds_Week(t *testing.T) {
	now := time.Date(2025, 6, 8, 0, 0, 0, 0, time.UTC)
	startDay, _, _, _ := analytics.RangeBounds("week", now)
	assert.Equal(t, "2025-06-02", startDay) // -6 days
}

func TestRangeBounds_Month(t *testing.T) {
	now := time.Date(2025, 6, 30, 0, 0, 0, 0, time.UTC)
	startDay, _, _, _ := analytics.RangeBounds("month", now)
	assert.Equal(t, "2025-06-01", startDay) // -29 days
}

func TestRangeBounds_All(t *testing.T) {
	now := time.Now()
	_, _, startUnix, _ := analytics.RangeBounds("all", now)
	assert.Equal(t, int64(0), startUnix)
}

// ---- longestStreak ----------------------------------------------------------

func TestLongestStreak_Empty(t *testing.T) {
	assert.Equal(t, int64(0), analytics.LongestStreak(nil))
}

func TestLongestStreak_Consecutive(t *testing.T) {
	days := []analytics.DayCount{
		{Day: "2025-01-01", Total: 3},
		{Day: "2025-01-02", Total: 2},
		{Day: "2025-01-03", Total: 5},
		{Day: "2025-01-05", Total: 1}, // gap on 01-04
		{Day: "2025-01-06", Total: 2},
	}
	assert.Equal(t, int64(3), analytics.LongestStreak(days))
}

func TestLongestStreak_Single(t *testing.T) {
	assert.Equal(t, int64(1), analytics.LongestStreak([]analytics.DayCount{{Day: "2025-01-01", Total: 1}}))
}

// ---- highestVolumeDay -------------------------------------------------------

func TestHighestVolumeDay(t *testing.T) {
	days := []analytics.DayCount{
		{Day: "2025-01-01", Total: 3},
		{Day: "2025-01-02", Total: 10},
		{Day: "2025-01-03", Total: 5},
	}
	day, count := analytics.HighestVolumeDay(days)
	assert.Equal(t, "2025-01-02", day)
	assert.Equal(t, int64(10), count)
}

func TestHighestVolumeDay_Empty(t *testing.T) {
	day, count := analytics.HighestVolumeDay(nil)
	assert.Equal(t, "", day)
	assert.Equal(t, int64(0), count)
}

// ---- monthlyTrend -----------------------------------------------------------

func TestMonthlyTrend_TooFewMonths(t *testing.T) {
	months := []analytics.MonthRow{
		{Month: "2025-01", Me: 10, Total: 20},
		{Month: "2025-02", Me: 5, Total: 20},
	}
	assert.Equal(t, 0.0, analytics.MonthlyTrend(months))
}

func TestMonthlyTrend_Increasing(t *testing.T) {
	// Me share goes from 20% → 80% — positive trend.
	months := []analytics.MonthRow{
		{Month: "2025-01", Me: 2, Total: 10}, // 20%
		{Month: "2025-02", Me: 2, Total: 10}, // 20%
		{Month: "2025-03", Me: 8, Total: 10}, // 80%
		{Month: "2025-04", Me: 8, Total: 10}, // 80%
	}
	trend := analytics.MonthlyTrend(months)
	assert.Greater(t, trend, 0.0)
}
