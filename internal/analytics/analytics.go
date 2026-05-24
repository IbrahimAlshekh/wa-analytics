package analytics

import (
	"context"
	"fmt"
	"sort"
	"time"
)

// AnalyticsQuerier is the read-only database interface Compute uses.
// Implemented by *db.DB; lives here to avoid an import cycle.
type AnalyticsQuerier interface {
	GetAnalyticsTotals(ctx context.Context, contactID int64, startDay, endDay string) (me, them SideTotals, err error)
	GetAnalyticsHourHist(ctx context.Context, contactID int64, startDay, endDay string) (me, them [24]int64, err error)
	GetAnalyticsDOWHist(ctx context.Context, contactID int64, startDay, endDay string) (me, them [7]int64, err error)
	GetAnalyticsDayCounts(ctx context.Context, contactID int64, startDay, endDay string) ([]DayCount, error)
	GetAnalyticsFirstLast(ctx context.Context, contactID int64, startUnix, endUnix int64) (firstUnix, lastUnix int64, err error)
	GetAnalyticsMessages(ctx context.Context, contactID int64, startUnix, endUnix int64) ([]MsgRow, error)
	GetTopEmojis(ctx context.Context, contactID int64, startDay, endDay string, limit int) (me, them []TokenCount, err error)
	GetTopWords(ctx context.Context, contactID int64, startDay, endDay string, limit int) (me, them []TokenCount, err error)
	GetTopDomains(ctx context.Context, contactID int64, startDay, endDay string) (me, them []TokenCount, err error)
	GetTopStickers(ctx context.Context, contactID int64, startDay, endDay string, limit int) (me, them []StickerUsage, err error)
	GetMonthlyTotals(ctx context.Context, contactID int64, startDay, endDay string) ([]MonthRow, error)
	GetSyncLaughDays(ctx context.Context, contactID int64, startDay, endDay string) (int64, error)
}

// MsgRow is a minimal message record used for initiation/response-time computation.
type MsgRow struct {
	Timestamp int64
	IsFromMe  bool
}

// SideTotals holds per-sender aggregated analytics totals over a date range.
type SideTotals struct {
	Messages   int64
	Words      int64
	Chars      int64
	VoiceNotes int64
	Photos     int64
	Videos     int64
	Stickers   int64
	Documents  int64
	Links      int64
	Questions  int64
	Laughter   int64
	NightMsgs  int64
	ELove      int64
	EMiss      int64
	EHappy     int64
	ESad       int64
	ECare      int64
	EEncourage int64
	EApology   int64
	EGratitude int64
}

// DayCount holds the total message count for a single calendar day.
type DayCount struct {
	Day   string
	Total int64
}

// TokenCount pairs a token (emoji/word/domain) with its occurrence count.
type TokenCount struct {
	Token string `json:"token"`
	Count int64  `json:"count"`
}

// StickerUsage records how often a specific sticker was used.
type StickerUsage struct {
	Hash  string `json:"hash"`
	Path  string `json:"path"`
	Count int64  `json:"count"`
}

// MonthRow holds message counts for a calendar month.
type MonthRow struct {
	Month      string  `json:"month"`      // "YYYY-MM"
	Me         int64   `json:"me"`
	Them       int64   `json:"them"`
	Total      int64   `json:"total"`
	MeSharePct float64 `json:"meSharePct"`
}

type LanguageSection struct {
	TopEmojisMe    []TokenCount   `json:"topEmojisMe"`
	TopEmojisThem  []TokenCount   `json:"topEmojisThem"`
	TopWordsMe     []TokenCount   `json:"topWordsMe"`
	TopWordsThem   []TokenCount   `json:"topWordsThem"`
	TopDomainsMe   []TokenCount   `json:"topDomainsMe"`
	TopDomainsThem []TokenCount   `json:"topDomainsThem"`
	TopStickersMe  []StickerUsage `json:"topStickersMe"`
	TopStickersThem []StickerUsage `json:"topStickersThem"`
}

type IndicatorSection struct {
	WordBalancePct      float64 `json:"wordBalancePct"`
	MsgBalancePct       float64 `json:"msgBalancePct"`
	DailyConsistencyPct float64 `json:"dailyConsistencyPct"`
	MedianRespAllSec    float64 `json:"medianRespAllSec"`
	InitiationMePct     float64 `json:"initiationMePct"`
	SyncLaughDays       int64   `json:"syncLaughDays"`
	TotalQuestions      int64   `json:"totalQuestions"`
	TotalLaughter       int64   `json:"totalLaughter"`
	MeShareTrendPct     float64 `json:"meShareTrendPct"`
}

// Report is the full analytics report for a contact over a date range.
type Report struct {
	Range      string            `json:"range"`
	StartUnix  int64             `json:"startUnix"`
	EndUnix    int64             `json:"endUnix"`
	Timeline   TimelineSection   `json:"timeline"`
	Volume     VolumeSplit       `json:"volume"`
	Temporal   TemporalSection   `json:"temporal"`
	Emotion    EmotionSection    `json:"emotion"`
	Initiation InitiationSection `json:"initiation"`
	Language   LanguageSection   `json:"language"`
	Indicators IndicatorSection  `json:"indicators"`
}

type TimelineSection struct {
	FirstMsgUnix          int64  `json:"firstMsgUnix"`
	LastMsgUnix           int64  `json:"lastMsgUnix"`
	SpanDays              int64  `json:"spanDays"`
	DaysWithComms         int64  `json:"daysWithComms"`
	LongestStreakDays      int64  `json:"longestStreakDays"`
	HighestVolumeDayDate  string `json:"highestVolumeDayDate"`
	HighestVolumeDayCount int64  `json:"highestVolumeDayCount"`
}

type VolumeSide struct {
	Messages       int64   `json:"messages"`
	Words          int64   `json:"words"`
	AvgWordsPerMsg float64 `json:"avgWordsPerMsg"`
	VoiceNotes     int64   `json:"voiceNotes"`
	Photos         int64   `json:"photos"`
	Videos         int64   `json:"videos"`
	Stickers       int64   `json:"stickers"`
	Documents      int64   `json:"documents"`
	Links          int64   `json:"links"`
	Questions      int64   `json:"questions"`
	SharePct       float64 `json:"sharePct"`
}

type VolumeSplit struct {
	Me   VolumeSide `json:"me"`
	Them VolumeSide `json:"them"`
}

type TemporalSection struct {
	HourHistMe   [24]int64  `json:"hourHistMe"`
	HourHistThem [24]int64  `json:"hourHistThem"`
	DowMe        [7]int64   `json:"dowMe"`
	DowThem      [7]int64   `json:"dowThem"`
	NightPctMe   float64    `json:"nightPctMe"`
	NightPctThem float64    `json:"nightPctThem"`
	Monthly      []MonthRow `json:"monthly"`
}

type EmotionCounts struct {
	Love      int64 `json:"love"`
	Miss      int64 `json:"miss"`
	Happy     int64 `json:"happy"`
	Sad       int64 `json:"sad"`
	Care      int64 `json:"care"`
	Encourage int64 `json:"encourage"`
	Apology   int64 `json:"apology"`
	Gratitude int64 `json:"gratitude"`
}

type EmotionSection struct {
	CountsMe         EmotionCounts `json:"countsMe"`
	CountsThem       EmotionCounts `json:"countsThem"`
	LaughterMsgsMe   int64         `json:"laughterMsgsMe"`
	LaughterMsgsThem int64         `json:"laughterMsgsThem"`
	QuestionsMe      int64         `json:"questionsMe"`
	QuestionsThem    int64         `json:"questionsThem"`
}

type InitiationSection struct {
	InitiatedMe          int64   `json:"initiatedMe"`
	InitiatedThem        int64   `json:"initiatedThem"`
	InitiationMeSharePct float64 `json:"initiationMeSharePct"`
	AvgRespMeSec         float64 `json:"avgRespMeSec"`
	AvgRespThemSec       float64 `json:"avgRespThemSec"`
	MedianRespMeSec      float64 `json:"medianRespMeSec"`
	MedianRespThemSec    float64 `json:"medianRespThemSec"`
	Sessions             int64   `json:"sessions"`
	AvgSessionMsgs       float64 `json:"avgSessionMsgs"`
	LongestSilenceSec    int64   `json:"longestSilenceSec"`
	AvgSilenceSec        float64 `json:"avgSilenceSec"`
	MedianRespAllSec     float64 `json:"medianRespAllSec"`
}

// Compute returns a Report for contactID over the named range ending at now.
// Recognized range names: "day" (today), "week" (last 7 days), "month" (last 30 days), "all".
func Compute(ctx context.Context, q AnalyticsQuerier, contactID int64, rangeName string, now time.Time) (Report, error) {
	startDay, endDay, startUnix, endUnix := rangeBounds(rangeName, now)
	return computeWithBounds(ctx, q, contactID, rangeName, startDay, endDay, startUnix, endUnix)
}

// ComputeCustom returns a Report for contactID over an explicit date range.
// startDay and endDay must be in "YYYY-MM-DD" format. endDay is inclusive.
func ComputeCustom(ctx context.Context, q AnalyticsQuerier, contactID int64, startDay, endDay string) (Report, error) {
	loc := time.Local
	start, err := time.ParseInLocation("2006-01-02", startDay, loc)
	if err != nil {
		return Report{}, fmt.Errorf("invalid start date: %w", err)
	}
	end, err := time.ParseInLocation("2006-01-02", endDay, loc)
	if err != nil {
		return Report{}, fmt.Errorf("invalid end date: %w", err)
	}
	startUnix := start.Unix()
	endUnix := end.AddDate(0, 0, 1).Unix() - 1 // inclusive end-of-day
	return computeWithBounds(ctx, q, contactID, "custom", startDay, endDay, startUnix, endUnix)
}

func computeWithBounds(ctx context.Context, q AnalyticsQuerier, contactID int64, label, startDay, endDay string, startUnix, endUnix int64) (Report, error) {
	me, them, err := q.GetAnalyticsTotals(ctx, contactID, startDay, endDay)
	if err != nil {
		return Report{}, err
	}

	hourMe, hourThem, err := q.GetAnalyticsHourHist(ctx, contactID, startDay, endDay)
	if err != nil {
		return Report{}, err
	}

	dowMe, dowThem, err := q.GetAnalyticsDOWHist(ctx, contactID, startDay, endDay)
	if err != nil {
		return Report{}, err
	}

	dayCounts, err := q.GetAnalyticsDayCounts(ctx, contactID, startDay, endDay)
	if err != nil {
		return Report{}, err
	}

	firstUnix, lastUnix, err := q.GetAnalyticsFirstLast(ctx, contactID, startUnix, endUnix)
	if err != nil {
		return Report{}, err
	}

	msgs, err := q.GetAnalyticsMessages(ctx, contactID, startUnix, endUnix)
	if err != nil {
		return Report{}, err
	}

	topEmojisMe, topEmojisThem, err := q.GetTopEmojis(ctx, contactID, startDay, endDay, 10)
	if err != nil {
		return Report{}, err
	}
	topWordsMe, topWordsThem, err := q.GetTopWords(ctx, contactID, startDay, endDay, 15)
	if err != nil {
		return Report{}, err
	}
	topDomainsMe, topDomainsThem, err := q.GetTopDomains(ctx, contactID, startDay, endDay)
	if err != nil {
		return Report{}, err
	}
	topStickersMe, topStickersThem, err := q.GetTopStickers(ctx, contactID, startDay, endDay, 10)
	if err != nil {
		return Report{}, err
	}
	monthly, err := q.GetMonthlyTotals(ctx, contactID, startDay, endDay)
	if err != nil {
		return Report{}, err
	}
	syncLaughDays, err := q.GetSyncLaughDays(ctx, contactID, startDay, endDay)
	if err != nil {
		return Report{}, err
	}

	daysWithComms := int64(len(dayCounts))
	streak := longestStreak(dayCounts)
	hvDay, hvCount := highestVolumeDay(dayCounts)

	spanDays := int64(0)
	if firstUnix > 0 && lastUnix > 0 {
		spanDays = (lastUnix-firstUnix)/86400 + 1
	}

	totalMsgs := me.Messages + them.Messages

	initiation := computeInitiation(msgs)

	indicators := IndicatorSection{
		WordBalancePct:      pct(me.Words, me.Words+them.Words),
		MsgBalancePct:       pct(me.Messages, totalMsgs),
		DailyConsistencyPct: pct(daysWithComms, spanDays),
		MedianRespAllSec:    initiation.MedianRespAllSec,
		InitiationMePct:     initiation.InitiationMeSharePct,
		SyncLaughDays:       syncLaughDays,
		TotalQuestions:      me.Questions + them.Questions,
		TotalLaughter:       me.Laughter + them.Laughter,
		MeShareTrendPct:     monthlyTrend(monthly),
	}

	return Report{
		Range:     label,
		StartUnix: startUnix,
		EndUnix:   endUnix,
		Timeline: TimelineSection{
			FirstMsgUnix:          firstUnix,
			LastMsgUnix:           lastUnix,
			SpanDays:              spanDays,
			DaysWithComms:         daysWithComms,
			LongestStreakDays:     streak,
			HighestVolumeDayDate:  hvDay,
			HighestVolumeDayCount: hvCount,
		},
		Volume: VolumeSplit{
			Me: VolumeSide{
				Messages:       me.Messages,
				Words:          me.Words,
				AvgWordsPerMsg: safeDivF(me.Words, me.Messages),
				VoiceNotes:     me.VoiceNotes,
				Photos:         me.Photos,
				Videos:         me.Videos,
				Stickers:       me.Stickers,
				Documents:      me.Documents,
				Links:          me.Links,
				Questions:      me.Questions,
				SharePct:       pct(me.Messages, totalMsgs),
			},
			Them: VolumeSide{
				Messages:       them.Messages,
				Words:          them.Words,
				AvgWordsPerMsg: safeDivF(them.Words, them.Messages),
				VoiceNotes:     them.VoiceNotes,
				Photos:         them.Photos,
				Videos:         them.Videos,
				Stickers:       them.Stickers,
				Documents:      them.Documents,
				Links:          them.Links,
				Questions:      them.Questions,
				SharePct:       pct(them.Messages, totalMsgs),
			},
		},
		Temporal: TemporalSection{
			HourHistMe:   hourMe,
			HourHistThem: hourThem,
			DowMe:        dowMe,
			DowThem:      dowThem,
			NightPctMe:   pct(me.NightMsgs, me.Messages),
			NightPctThem: pct(them.NightMsgs, them.Messages),
			Monthly:      monthly,
		},
		Emotion: EmotionSection{
			CountsMe: EmotionCounts{
				Love:      me.ELove,
				Miss:      me.EMiss,
				Happy:     me.EHappy,
				Sad:       me.ESad,
				Care:      me.ECare,
				Encourage: me.EEncourage,
				Apology:   me.EApology,
				Gratitude: me.EGratitude,
			},
			CountsThem: EmotionCounts{
				Love:      them.ELove,
				Miss:      them.EMiss,
				Happy:     them.EHappy,
				Sad:       them.ESad,
				Care:      them.ECare,
				Encourage: them.EEncourage,
				Apology:   them.EApology,
				Gratitude: them.EGratitude,
			},
			LaughterMsgsMe:   me.Laughter,
			LaughterMsgsThem: them.Laughter,
			QuestionsMe:      me.Questions,
			QuestionsThem:    them.Questions,
		},
		Initiation: initiation,
		Language: LanguageSection{
			TopEmojisMe:     topEmojisMe,
			TopEmojisThem:   topEmojisThem,
			TopWordsMe:      topWordsMe,
			TopWordsThem:    topWordsThem,
			TopDomainsMe:    topDomainsMe,
			TopDomainsThem:  topDomainsThem,
			TopStickersMe:   topStickersMe,
			TopStickersThem: topStickersThem,
		},
		Indicators: indicators,
	}, nil
}

// sessionGap is the silence threshold in seconds that marks a new conversation session.
const sessionGap = int64(3600)

// computeInitiation derives initiation, response-time, and session stats from an ordered message list.
func computeInitiation(msgs []MsgRow) InitiationSection {
	if len(msgs) == 0 {
		return InitiationSection{}
	}

	var (
		initiatedMe, initiatedThem int64
		respTimesMe, respTimesThem []int64
		sessionMsgCounts           []int64
		silences                   []int64
		longestSilence             int64

		sessionMsgs = int64(1)
		sessionCount = int64(1)
		lastTS       = msgs[0].Timestamp
		lastSide     = msgs[0].IsFromMe
	)

	if msgs[0].IsFromMe {
		initiatedMe++
	} else {
		initiatedThem++
	}

	for i := 1; i < len(msgs); i++ {
		m := msgs[i]
		gap := m.Timestamp - lastTS

		if gap > sessionGap {
			sessionMsgCounts = append(sessionMsgCounts, sessionMsgs)
			silences = append(silences, gap)
			if gap > longestSilence {
				longestSilence = gap
			}
			sessionMsgs = 1
			sessionCount++
			if m.IsFromMe {
				initiatedMe++
			} else {
				initiatedThem++
			}
		} else {
			sessionMsgs++
			if m.IsFromMe != lastSide {
				if m.IsFromMe {
					respTimesMe = append(respTimesMe, gap)
				} else {
					respTimesThem = append(respTimesThem, gap)
				}
			}
		}

		lastTS = m.Timestamp
		lastSide = m.IsFromMe
	}
	sessionMsgCounts = append(sessionMsgCounts, sessionMsgs)

	totalMsgInSessions := int64(0)
	for _, c := range sessionMsgCounts {
		totalMsgInSessions += c
	}

	total := initiatedMe + initiatedThem

	allResp := make([]int64, 0, len(respTimesMe)+len(respTimesThem))
	allResp = append(allResp, respTimesMe...)
	allResp = append(allResp, respTimesThem...)

	return InitiationSection{
		InitiatedMe:          initiatedMe,
		InitiatedThem:        initiatedThem,
		InitiationMeSharePct: pct(initiatedMe, total),
		AvgRespMeSec:         meanF(respTimesMe),
		AvgRespThemSec:       meanF(respTimesThem),
		MedianRespMeSec:      medianF(respTimesMe),
		MedianRespThemSec:    medianF(respTimesThem),
		Sessions:             sessionCount,
		AvgSessionMsgs:       safeDivF(totalMsgInSessions, sessionCount),
		LongestSilenceSec:    longestSilence,
		AvgSilenceSec:        meanF(silences),
		MedianRespAllSec:     medianF(allResp),
	}
}

func meanF(vals []int64) float64 {
	if len(vals) == 0 {
		return 0
	}
	sum := int64(0)
	for _, v := range vals {
		sum += v
	}
	return float64(sum) / float64(len(vals))
}

func medianF(vals []int64) float64 {
	if len(vals) == 0 {
		return 0
	}
	sorted := make([]int64, len(vals))
	copy(sorted, vals)
	sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })
	n := len(sorted)
	if n%2 == 0 {
		return float64(sorted[n/2-1]+sorted[n/2]) / 2
	}
	return float64(sorted[n/2])
}

// rangeBounds converts a range name to day strings and unix timestamps.
func rangeBounds(name string, now time.Time) (startDay, endDay string, startUnix, endUnix int64) {
	end := now
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	var start time.Time
	switch name {
	case "week":
		start = startOfToday.AddDate(0, 0, -6)
	case "month":
		start = startOfToday.AddDate(0, 0, -29)
	case "all":
		start = time.Unix(0, 0)
	default: // "day"
		start = startOfToday
	}
	return start.Format("2006-01-02"), end.Local().Format("2006-01-02"), start.Unix(), end.Unix()
}

func longestStreak(dayCounts []DayCount) int64 {
	if len(dayCounts) == 0 {
		return 0
	}
	sort.Slice(dayCounts, func(i, j int) bool { return dayCounts[i].Day < dayCounts[j].Day })
	best, cur := int64(1), int64(1)
	for i := 1; i < len(dayCounts); i++ {
		prev, _ := time.ParseInLocation("2006-01-02", dayCounts[i-1].Day, time.Local)
		this, _ := time.ParseInLocation("2006-01-02", dayCounts[i].Day, time.Local)
		if this.Sub(prev) == 24*time.Hour {
			cur++
		} else {
			cur = 1
		}
		if cur > best {
			best = cur
		}
	}
	return best
}

func highestVolumeDay(dayCounts []DayCount) (day string, count int64) {
	for _, dc := range dayCounts {
		if dc.Total > count {
			count = dc.Total
			day = dc.Day
		}
	}
	return
}

func safeDivF(num, denom int64) float64 {
	if denom == 0 {
		return 0
	}
	return float64(num) / float64(denom)
}

func pct(part, total int64) float64 {
	if total == 0 {
		return 0
	}
	return float64(part) / float64(total) * 100
}

// monthlyTrend returns how my message share changed (second half minus first half of months).
// Returns 0 if there are fewer than 4 months.
func monthlyTrend(months []MonthRow) float64 {
	n := len(months)
	if n < 4 {
		return 0
	}
	half := n / 2
	first, second := months[:half], months[n-half:]
	var firstMe, firstTotal, secondMe, secondTotal int64
	for _, m := range first {
		firstMe += m.Me
		firstTotal += m.Total
	}
	for _, m := range second {
		secondMe += m.Me
		secondTotal += m.Total
	}
	if firstTotal == 0 || secondTotal == 0 {
		return 0
	}
	return (float64(secondMe)/float64(secondTotal) - float64(firstMe)/float64(firstTotal)) * 100
}
