package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/analytics"
)

// InsertMessageWithAnalytics stores a new message (with derived analytics columns) and
// incrementally updates the analytics aggregate tables for the contact.
// If the message is a duplicate (INSERT OR IGNORE hit), returns an empty Message with nil error.
// Analytics failures are logged but never prevent message storage.
func (db *DB) InsertMessageWithAnalytics(ctx context.Context, m Message, f analytics.MessageFeatures) (Message, error) {
	saved, err := db.insertMessageWithDerived(ctx, m, f)
	if err != nil {
		return Message{}, err
	}
	if saved.ID == 0 || m.ContactID == nil {
		return saved, nil
	}

	side := "them"
	if m.IsFromMe {
		side = "me"
	}
	day := time.Unix(m.Timestamp, 0).Local().Format("2006-01-02")

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		slog.Warn("db: analytics tx begin failed", "messageID", m.MessageID, "err", err)
		return saved, nil
	}
	if err := db.ApplyMessageAnalyticsTx(ctx, tx, *m.ContactID, side, day, m.MediaType, f); err != nil {
		_ = tx.Rollback()
		slog.Warn("db: analytics apply failed", "messageID", m.MessageID, "err", err)
		return saved, nil
	}
	if err := tx.Commit(); err != nil {
		slog.Warn("db: analytics tx commit failed", "messageID", m.MessageID, "err", err)
	}
	return saved, nil
}

// insertMessageWithDerived runs the INSERT OR IGNORE with all derived feature columns filled.
func (db *DB) insertMessageWithDerived(ctx context.Context, m Message, f analytics.MessageFeatures) (Message, error) {
	res, err := db.ExecContext(ctx,
		`INSERT OR IGNORE INTO messages
		 (account_id, contact_id, chat_jid, message_id, sender_jid, is_from_me, timestamp,
		  text, media_type, media_path, received_at,
		  word_count, char_count, has_question, has_laughter,
		  emoji_json, word_json, url_domain_json,
		  emotion_mask, emotion_counts_json, hour_local, dow_local)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?, ?,?,?,?,?,?,?, ?,?,?,?)`,
		m.AccountID, nullInt64Ptr(m.ContactID), db.enc(m.ChatJID), m.MessageID,
		db.enc(m.SenderJID), boolToInt(m.IsFromMe), m.Timestamp,
		nullStr(m.Text), nullStr(m.MediaType), nullStr(m.MediaPath), m.ReceivedAt,
		f.WordCount, f.CharCount, boolToInt(f.HasQuestion), boolToInt(f.HasLaughter),
		jsonOrNullStr(uniqueStrings(f.Emojis, 100)),
		jsonOrNullStr(uniqueStrings(f.Words, 50)),
		jsonOrNullStr(f.URLDomains),
		f.EmotionMask, emotionCountsJSON(f.EmotionCounts),
		f.HourLocal, f.DowLocal,
	)
	if err != nil {
		return Message{}, err
	}
	id, _ := res.LastInsertId()
	if id == 0 {
		return Message{}, nil
	}
	m.ID = id
	return m, nil
}

// UpdateMessageDerivedTx sets the derived analytics columns on an existing message row.
// Called by the analytics-backfill CLI within a larger transaction.
func (db *DB) UpdateMessageDerivedTx(ctx context.Context, tx *sql.Tx, msgID int64, f analytics.MessageFeatures) error {
	_, err := tx.ExecContext(ctx,
		`UPDATE messages SET
		  word_count=?, char_count=?, has_question=?, has_laughter=?,
		  emoji_json=?, word_json=?, url_domain_json=?,
		  emotion_mask=?, emotion_counts_json=?,
		  hour_local=?, dow_local=?
		 WHERE id=?`,
		f.WordCount, f.CharCount, boolToInt(f.HasQuestion), boolToInt(f.HasLaughter),
		jsonOrNullStr(uniqueStrings(f.Emojis, 100)),
		jsonOrNullStr(uniqueStrings(f.Words, 50)),
		jsonOrNullStr(f.URLDomains),
		f.EmotionMask, emotionCountsJSON(f.EmotionCounts),
		f.HourLocal, f.DowLocal,
		msgID,
	)
	return err
}

// ApplyMessageAnalyticsTx UPSERTs analytics aggregate rows for one message within tx.
// mediaType is the value from the messages.media_type column.
// Called by InsertMessageWithAnalytics (in its own tx) and by the backfill CLI.
func (db *DB) ApplyMessageAnalyticsTx(ctx context.Context, tx *sql.Tx, contactID int64, senderSide, day, mediaType string, f analytics.MessageFeatures) error {
	voiceNotes, photos, videos, stickers, documents, links := mediaFlags(mediaType, f.URLDomains)

	_, err := tx.ExecContext(ctx,
		`INSERT INTO analytics_daily
		  (contact_id, day, sender_side,
		   messages, words, chars,
		   voice_notes, photos, videos, stickers, documents, links,
		   questions, laughter_msgs, night_msgs,
		   e_love, e_miss, e_happy, e_sad, e_care, e_encourage, e_apology, e_gratitude)
		 VALUES (?,?,?, 1,?,?, ?,?,?,?,?,?, ?,?,?, ?,?,?,?,?,?,?,?)
		 ON CONFLICT(contact_id,day,sender_side) DO UPDATE SET
		  messages      = messages      + excluded.messages,
		  words         = words         + excluded.words,
		  chars         = chars         + excluded.chars,
		  voice_notes   = voice_notes   + excluded.voice_notes,
		  photos        = photos        + excluded.photos,
		  videos        = videos        + excluded.videos,
		  stickers      = stickers      + excluded.stickers,
		  documents     = documents     + excluded.documents,
		  links         = links         + excluded.links,
		  questions     = questions     + excluded.questions,
		  laughter_msgs = laughter_msgs + excluded.laughter_msgs,
		  night_msgs    = night_msgs    + excluded.night_msgs,
		  e_love        = e_love        + excluded.e_love,
		  e_miss        = e_miss        + excluded.e_miss,
		  e_happy       = e_happy       + excluded.e_happy,
		  e_sad         = e_sad         + excluded.e_sad,
		  e_care        = e_care        + excluded.e_care,
		  e_encourage   = e_encourage   + excluded.e_encourage,
		  e_apology     = e_apology     + excluded.e_apology,
		  e_gratitude   = e_gratitude   + excluded.e_gratitude`,
		contactID, day, senderSide,
		f.WordCount, f.CharCount,
		voiceNotes, photos, videos, stickers, documents, links,
		boolToInt(f.HasQuestion), boolToInt(f.HasLaughter), boolToInt(f.IsNightMsg),
		f.EmotionCounts[analytics.CatLove],
		f.EmotionCounts[analytics.CatMiss],
		f.EmotionCounts[analytics.CatHappy],
		f.EmotionCounts[analytics.CatSad],
		f.EmotionCounts[analytics.CatCare],
		f.EmotionCounts[analytics.CatEncourage],
		f.EmotionCounts[analytics.CatApology],
		f.EmotionCounts[analytics.CatGratitude],
	)
	if err != nil {
		return err
	}

	// Emoji counts
	emojiCounts := make(map[string]int, len(f.Emojis))
	for _, e := range f.Emojis {
		emojiCounts[e]++
	}
	for emoji, cnt := range emojiCounts {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO analytics_emoji_daily (contact_id, day, sender_side, emoji, count)
			 VALUES (?,?,?,?,?)
			 ON CONFLICT(contact_id,day,sender_side,emoji) DO UPDATE SET count=count+excluded.count`,
			contactID, day, senderSide, emoji, cnt,
		); err != nil {
			return err
		}
	}

	// Word counts
	wordCounts := make(map[string]int, len(f.Words))
	for _, w := range f.Words {
		wordCounts[w]++
	}
	for word, cnt := range wordCounts {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO analytics_word_daily (contact_id, day, sender_side, word, count)
			 VALUES (?,?,?,?,?)
			 ON CONFLICT(contact_id,day,sender_side,word) DO UPDATE SET count=count+excluded.count`,
			contactID, day, senderSide, word, cnt,
		); err != nil {
			return err
		}
	}

	// Domain counts (already deduplicated)
	for _, domain := range f.URLDomains {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO analytics_domain_daily (contact_id, day, sender_side, domain, count)
			 VALUES (?,?,?,?,1)
			 ON CONFLICT(contact_id,day,sender_side,domain) DO UPDATE SET count=count+1`,
			contactID, day, senderSide, domain,
		); err != nil {
			return err
		}
	}

	// Hour bucket
	if _, err := tx.ExecContext(ctx,
		`INSERT INTO analytics_hour_daily (contact_id, day, sender_side, hour, count)
		 VALUES (?,?,?,?,1)
		 ON CONFLICT(contact_id,day,sender_side,hour) DO UPDATE SET count=count+1`,
		contactID, day, senderSide, f.HourLocal,
	); err != nil {
		return err
	}

	return nil
}

// --- helpers ---

// mediaFlags returns binary (0/1) counters for each media type and link presence.
func mediaFlags(mediaType string, domains []string) (voiceNotes, photos, videos, stickers, documents, links int) {
	switch mediaType {
	case "audio":
		voiceNotes = 1
	case "image":
		photos = 1
	case "video":
		videos = 1
	case "sticker":
		stickers = 1
	case "document":
		documents = 1
	}
	if len(domains) > 0 {
		links = 1
	}
	return
}

// uniqueStrings returns a deduplicated copy of strs capped at maxLen.
func uniqueStrings(strs []string, maxLen int) []string {
	if len(strs) == 0 {
		return nil
	}
	seen := make(map[string]bool, len(strs))
	out := make([]string, 0, min(len(strs), maxLen))
	for _, s := range strs {
		if len(out) >= maxLen {
			break
		}
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

// jsonOrNullStr serialises strs to a JSON array string, or returns "" (→ SQL NULL) if empty.
func jsonOrNullStr(strs []string) any {
	if len(strs) == 0 {
		return nil
	}
	b, _ := json.Marshal(strs)
	return string(b)
}

// emotionCountsJSON serialises the emotion counts array to a JSON string, or nil if all zero.
func emotionCountsJSON(counts [analytics.NumCategories]int) any {
	for _, c := range counts {
		if c > 0 {
			b, _ := json.Marshal(counts)
			return string(b)
		}
	}
	return nil
}
