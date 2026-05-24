package db

import (
	"context"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/analytics"
)

// GetAnalyticsTotals returns per-sender-side aggregated totals over a day range.
func (d *DB) GetAnalyticsTotals(ctx context.Context, contactID int64, startDay, endDay string) (me, them analytics.SideTotals, err error) {
	rows, err := d.QueryContext(ctx, `
		SELECT sender_side,
			SUM(messages), SUM(words), SUM(chars),
			SUM(voice_notes), SUM(photos), SUM(videos), SUM(stickers), SUM(documents), SUM(links),
			SUM(questions), SUM(laughter_msgs), SUM(night_msgs),
			SUM(e_love), SUM(e_miss), SUM(e_happy), SUM(e_sad),
			SUM(e_care), SUM(e_encourage), SUM(e_apology), SUM(e_gratitude)
		FROM analytics_daily
		WHERE contact_id=? AND day BETWEEN ? AND ?
		GROUP BY sender_side`,
		contactID, startDay, endDay,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var side string
		var s analytics.SideTotals
		if err = rows.Scan(&side,
			&s.Messages, &s.Words, &s.Chars,
			&s.VoiceNotes, &s.Photos, &s.Videos, &s.Stickers, &s.Documents, &s.Links,
			&s.Questions, &s.Laughter, &s.NightMsgs,
			&s.ELove, &s.EMiss, &s.EHappy, &s.ESad,
			&s.ECare, &s.EEncourage, &s.EApology, &s.EGratitude,
		); err != nil {
			return
		}
		if side == "me" {
			me = s
		} else {
			them = s
		}
	}
	err = rows.Err()
	return
}

// GetAnalyticsHourHist returns per-hour message counts for each sender side (0–23).
func (d *DB) GetAnalyticsHourHist(ctx context.Context, contactID int64, startDay, endDay string) (me, them [24]int64, err error) {
	rows, err := d.QueryContext(ctx, `
		SELECT sender_side, hour, SUM(count)
		FROM analytics_hour_daily
		WHERE contact_id=? AND day BETWEEN ? AND ?
		GROUP BY sender_side, hour`,
		contactID, startDay, endDay,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var side string
		var hour int
		var count int64
		if err = rows.Scan(&side, &hour, &count); err != nil {
			return
		}
		if hour >= 0 && hour < 24 {
			if side == "me" {
				me[hour] = count
			} else {
				them[hour] = count
			}
		}
	}
	err = rows.Err()
	return
}

// GetAnalyticsDOWHist returns per-weekday message counts for each sender side.
// Index 0=Sunday … 6=Saturday (matching time.Weekday).
func (d *DB) GetAnalyticsDOWHist(ctx context.Context, contactID int64, startDay, endDay string) (me, them [7]int64, err error) {
	rows, err := d.QueryContext(ctx, `
		SELECT sender_side, CAST(strftime('%w', day) AS INTEGER) as dow, SUM(messages)
		FROM analytics_daily
		WHERE contact_id=? AND day BETWEEN ? AND ?
		GROUP BY sender_side, dow`,
		contactID, startDay, endDay,
	)
	if err != nil {
		return
	}
	defer rows.Close()

	for rows.Next() {
		var side string
		var dow int
		var count int64
		if err = rows.Scan(&side, &dow, &count); err != nil {
			return
		}
		if dow >= 0 && dow < 7 {
			if side == "me" {
				me[dow] += count
			} else {
				them[dow] += count
			}
		}
	}
	err = rows.Err()
	return
}

// GetAnalyticsDayCounts returns the total message count per day, sorted ascending.
func (d *DB) GetAnalyticsDayCounts(ctx context.Context, contactID int64, startDay, endDay string) ([]analytics.DayCount, error) {
	rows, err := d.QueryContext(ctx, `
		SELECT day, SUM(messages)
		FROM analytics_daily
		WHERE contact_id=? AND day BETWEEN ? AND ?
		GROUP BY day
		ORDER BY day ASC`,
		contactID, startDay, endDay,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []analytics.DayCount
	for rows.Next() {
		var dc analytics.DayCount
		if err := rows.Scan(&dc.Day, &dc.Total); err != nil {
			return nil, err
		}
		out = append(out, dc)
	}
	return out, rows.Err()
}

// GetAnalyticsFirstLast returns unix timestamps of the first and last messages in the range.
func (d *DB) GetAnalyticsFirstLast(ctx context.Context, contactID int64, startUnix, endUnix int64) (firstUnix, lastUnix int64, err error) {
	err = d.QueryRowContext(ctx, `
		SELECT COALESCE(MIN(timestamp), 0), COALESCE(MAX(timestamp), 0)
		FROM messages
		WHERE contact_id=? AND timestamp BETWEEN ? AND ?`,
		contactID, startUnix, endUnix,
	).Scan(&firstUnix, &lastUnix)
	return
}

// GetAnalyticsMessages returns (timestamp, is_from_me) for all messages in the range, sorted ascending.
// Used for in-memory initiation/response-time/session computation.
func (d *DB) GetAnalyticsMessages(ctx context.Context, contactID int64, startUnix, endUnix int64) ([]analytics.MsgRow, error) {
	rows, err := d.QueryContext(ctx, `
		SELECT timestamp, is_from_me
		FROM messages
		WHERE contact_id=? AND timestamp BETWEEN ? AND ?
		ORDER BY timestamp ASC`,
		contactID, startUnix, endUnix,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []analytics.MsgRow
	for rows.Next() {
		var r analytics.MsgRow
		var fromMe int
		if err := rows.Scan(&r.Timestamp, &fromMe); err != nil {
			return nil, err
		}
		r.IsFromMe = fromMe == 1
		out = append(out, r)
	}
	return out, rows.Err()
}

// GetTopEmojis returns the top emojis per sender side, capped at limit per side.
func (d *DB) GetTopEmojis(ctx context.Context, contactID int64, startDay, endDay string, limit int) (me, them []analytics.TokenCount, err error) {
	rows, err := d.QueryContext(ctx, `
		SELECT sender_side, emoji, SUM(count) as total
		FROM analytics_emoji_daily
		WHERE contact_id=? AND day BETWEEN ? AND ?
		GROUP BY sender_side, emoji
		ORDER BY sender_side, total DESC`,
		contactID, startDay, endDay,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var side, token string
		var count int64
		if err = rows.Scan(&side, &token, &count); err != nil {
			return
		}
		if side == "me" && len(me) < limit {
			me = append(me, analytics.TokenCount{Token: token, Count: count})
		} else if side == "them" && len(them) < limit {
			them = append(them, analytics.TokenCount{Token: token, Count: count})
		}
	}
	err = rows.Err()
	return
}

// GetTopWords returns the top words per sender side, capped at limit per side.
func (d *DB) GetTopWords(ctx context.Context, contactID int64, startDay, endDay string, limit int) (me, them []analytics.TokenCount, err error) {
	rows, err := d.QueryContext(ctx, `
		SELECT sender_side, word, SUM(count) as total
		FROM analytics_word_daily
		WHERE contact_id=? AND day BETWEEN ? AND ?
		GROUP BY sender_side, word
		ORDER BY sender_side, total DESC`,
		contactID, startDay, endDay,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var side, token string
		var count int64
		if err = rows.Scan(&side, &token, &count); err != nil {
			return
		}
		if side == "me" && len(me) < limit {
			me = append(me, analytics.TokenCount{Token: token, Count: count})
		} else if side == "them" && len(them) < limit {
			them = append(them, analytics.TokenCount{Token: token, Count: count})
		}
	}
	err = rows.Err()
	return
}

// GetTopDomains returns all domains per sender side, sorted by frequency.
func (d *DB) GetTopDomains(ctx context.Context, contactID int64, startDay, endDay string) (me, them []analytics.TokenCount, err error) {
	rows, err := d.QueryContext(ctx, `
		SELECT sender_side, domain, SUM(count) as total
		FROM analytics_domain_daily
		WHERE contact_id=? AND day BETWEEN ? AND ?
		GROUP BY sender_side, domain
		ORDER BY sender_side, total DESC`,
		contactID, startDay, endDay,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var side, token string
		var count int64
		if err = rows.Scan(&side, &token, &count); err != nil {
			return
		}
		if side == "me" {
			me = append(me, analytics.TokenCount{Token: token, Count: count})
		} else {
			them = append(them, analytics.TokenCount{Token: token, Count: count})
		}
	}
	err = rows.Err()
	return
}

// GetTopStickers returns the most-used stickers per sender side, capped at limit per side.
func (d *DB) GetTopStickers(ctx context.Context, contactID int64, startDay, endDay string, limit int) (me, them []analytics.StickerUsage, err error) {
	rows, err := d.QueryContext(ctx, `
		SELECT asd.sender_side, asd.sticker_hash, COALESCE(s.path,''), SUM(asd.count) as total
		FROM analytics_sticker_daily asd
		LEFT JOIN stickers s ON s.hash = asd.sticker_hash
		WHERE asd.contact_id=? AND asd.day BETWEEN ? AND ?
		GROUP BY asd.sender_side, asd.sticker_hash
		ORDER BY asd.sender_side, total DESC`,
		contactID, startDay, endDay,
	)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var side, hash, path string
		var count int64
		if err = rows.Scan(&side, &hash, &path, &count); err != nil {
			return
		}
		u := analytics.StickerUsage{Hash: hash, Path: path, Count: count}
		if side == "me" && len(me) < limit {
			me = append(me, u)
		} else if side == "them" && len(them) < limit {
			them = append(them, u)
		}
	}
	err = rows.Err()
	return
}

// GetMonthlyTotals returns per-month message counts for both sender sides.
func (d *DB) GetMonthlyTotals(ctx context.Context, contactID int64, startDay, endDay string) ([]analytics.MonthRow, error) {
	rows, err := d.QueryContext(ctx, `
		SELECT strftime('%Y-%m', day) as month, sender_side, SUM(messages) as total
		FROM analytics_daily
		WHERE contact_id=? AND day BETWEEN ? AND ?
		GROUP BY month, sender_side
		ORDER BY month ASC`,
		contactID, startDay, endDay,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type entry struct{ me, them int64 }
	byMonth := make(map[string]*entry)
	var order []string
	for rows.Next() {
		var month, side string
		var total int64
		if err := rows.Scan(&month, &side, &total); err != nil {
			return nil, err
		}
		if _, ok := byMonth[month]; !ok {
			byMonth[month] = &entry{}
			order = append(order, month)
		}
		if side == "me" {
			byMonth[month].me = total
		} else {
			byMonth[month].them = total
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out := make([]analytics.MonthRow, 0, len(order))
	for _, month := range order {
		e := byMonth[month]
		total := e.me + e.them
		mePct := float64(0)
		if total > 0 {
			mePct = float64(e.me) / float64(total) * 100
		}
		out = append(out, analytics.MonthRow{
			Month: month, Me: e.me, Them: e.them, Total: total, MeSharePct: mePct,
		})
	}
	return out, nil
}

// GetSyncLaughDays returns the number of days where both sides had laughter messages.
func (d *DB) GetSyncLaughDays(ctx context.Context, contactID int64, startDay, endDay string) (int64, error) {
	var count int64
	err := d.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM (
			SELECT day
			FROM analytics_daily
			WHERE contact_id=? AND day BETWEEN ? AND ?
			GROUP BY day
			HAVING SUM(CASE WHEN sender_side='me'   AND laughter_msgs > 0 THEN 1 ELSE 0 END) > 0
			   AND SUM(CASE WHEN sender_side='them' AND laughter_msgs > 0 THEN 1 ELSE 0 END) > 0
		)`,
		contactID, startDay, endDay,
	).Scan(&count)
	return count, err
}
