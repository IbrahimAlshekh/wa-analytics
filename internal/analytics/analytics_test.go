package analytics_test

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/analytics"
)

// ---- fakeQuerier ------------------------------------------------------------

type fakeQuerier struct {
	me, them         analytics.SideTotals
	hourMe, hourThem [24]int64
	dowMe, dowThem   [7]int64
	dayCounts        []analytics.DayCount
	firstUnix        int64
	lastUnix         int64
	msgs             []analytics.MsgRow
	monthly          []analytics.MonthRow
	syncLaughDays    int64
}

func (f *fakeQuerier) GetAnalyticsTotals(_ context.Context, _ int64, _, _ string) (analytics.SideTotals, analytics.SideTotals, error) {
	return f.me, f.them, nil
}
func (f *fakeQuerier) GetAnalyticsHourHist(_ context.Context, _ int64, _, _ string) ([24]int64, [24]int64, error) {
	return f.hourMe, f.hourThem, nil
}
func (f *fakeQuerier) GetAnalyticsDOWHist(_ context.Context, _ int64, _, _ string) ([7]int64, [7]int64, error) {
	return f.dowMe, f.dowThem, nil
}
func (f *fakeQuerier) GetAnalyticsDayCounts(_ context.Context, _ int64, _, _ string) ([]analytics.DayCount, error) {
	return f.dayCounts, nil
}
func (f *fakeQuerier) GetAnalyticsFirstLast(_ context.Context, _ int64, _, _ int64) (int64, int64, error) {
	return f.firstUnix, f.lastUnix, nil
}
func (f *fakeQuerier) GetAnalyticsMessages(_ context.Context, _ int64, _, _ int64) ([]analytics.MsgRow, error) {
	return f.msgs, nil
}
func (f *fakeQuerier) GetTopEmojis(_ context.Context, _ int64, _, _ string, _ int) ([]analytics.TokenCount, []analytics.TokenCount, error) {
	return nil, nil, nil
}
func (f *fakeQuerier) GetTopWords(_ context.Context, _ int64, _, _ string, _ int) ([]analytics.TokenCount, []analytics.TokenCount, error) {
	return nil, nil, nil
}
func (f *fakeQuerier) GetTopDomains(_ context.Context, _ int64, _, _ string) ([]analytics.TokenCount, []analytics.TokenCount, error) {
	return nil, nil, nil
}
func (f *fakeQuerier) GetTopStickers(_ context.Context, _ int64, _, _ string, _ int) ([]analytics.StickerUsage, []analytics.StickerUsage, error) {
	return nil, nil, nil
}
func (f *fakeQuerier) GetMonthlyTotals(_ context.Context, _ int64, _, _ string) ([]analytics.MonthRow, error) {
	return f.monthly, nil
}
func (f *fakeQuerier) GetSyncLaughDays(_ context.Context, _ int64, _, _ string) (int64, error) {
	return f.syncLaughDays, nil
}

// ---- Compute tests ----------------------------------------------------------

func TestCompute_EmptyData(t *testing.T) {
	q := &fakeQuerier{}
	report, err := analytics.Compute(context.Background(), q, 1, "day", time.Now())
	require.NoError(t, err)
	assert.Equal(t, "day", report.Range)
	assert.Zero(t, report.Volume.Me.Messages)
	assert.Zero(t, report.Volume.Them.Messages)
}

func TestCompute_BasicVolume(t *testing.T) {
	q := &fakeQuerier{
		me:        analytics.SideTotals{Messages: 10, Words: 50},
		them:      analytics.SideTotals{Messages: 5, Words: 20},
		firstUnix: time.Now().Add(-24 * time.Hour).Unix(),
		lastUnix:  time.Now().Unix(),
	}
	report, err := analytics.Compute(context.Background(), q, 1, "week", time.Now())
	require.NoError(t, err)
	assert.Equal(t, int64(10), report.Volume.Me.Messages)
	assert.Equal(t, int64(5), report.Volume.Them.Messages)
	// Me share ≈ 66.7%
	assert.InDelta(t, 66.67, report.Volume.Me.SharePct, 0.01)
}

func TestCompute_AllRanges(t *testing.T) {
	q := &fakeQuerier{}
	for _, r := range []string{"day", "week", "month", "all"} {
		report, err := analytics.Compute(context.Background(), q, 1, r, time.Now())
		require.NoError(t, err, "range: %s", r)
		assert.Equal(t, r, report.Range, "range: %s", r)
	}
}

func TestCompute_SpanDays(t *testing.T) {
	now := time.Now()
	q := &fakeQuerier{
		firstUnix: now.Add(-7 * 24 * time.Hour).Unix(),
		lastUnix:  now.Unix(),
	}
	report, err := analytics.Compute(context.Background(), q, 1, "all", now)
	require.NoError(t, err)
	assert.Equal(t, int64(8), report.Timeline.SpanDays, "7 days apart → span = 8")
}

func TestCompute_LongestStreak(t *testing.T) {
	q := &fakeQuerier{
		dayCounts: []analytics.DayCount{
			{Day: "2025-01-01", Total: 1},
			{Day: "2025-01-02", Total: 1},
			{Day: "2025-01-03", Total: 1},
			{Day: "2025-01-05", Total: 1}, // gap
		},
	}
	report, err := analytics.Compute(context.Background(), q, 1, "all", time.Now())
	require.NoError(t, err)
	assert.Equal(t, int64(3), report.Timeline.LongestStreakDays)
}
