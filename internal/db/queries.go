package db

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// --- Account ----------------------------------------------------------------

type Account struct {
	ID             int64  `json:"id"`
	JID            string `json:"jid"`
	Label          string `json:"label"`
	TrackingActive bool   `json:"trackingActive"`
	CreatedAt      int64  `json:"createdAt"`
	// Computed at call-site, not stored:
	Connected bool `json:"connected"`
}

func (db *DB) InsertAccount(ctx context.Context, jid, label string) (Account, error) {
	now := time.Now().Unix()
	res, err := db.ExecContext(ctx,
		`INSERT INTO accounts (jid, label, tracking_active, created_at) VALUES (?, ?, 1, ?)
		 ON CONFLICT(jid) DO UPDATE SET label=excluded.label`,
		db.enc(jid), label, now)
	if err != nil {
		return Account{}, err
	}
	id, _ := res.LastInsertId()
	if id == 0 {
		// ON CONFLICT path: fetch by JID
		return db.GetAccountByJID(ctx, jid)
	}
	return db.GetAccount(ctx, id)
}

func (db *DB) GetAccount(ctx context.Context, id int64) (Account, error) {
	var a Account
	var active int
	err := db.QueryRowContext(ctx,
		`SELECT id, jid, COALESCE(label,''), tracking_active, created_at FROM accounts WHERE id=?`, id).
		Scan(&a.ID, &a.JID, &a.Label, &active, &a.CreatedAt)
	if err != nil {
		return Account{}, err
	}
	a.JID = db.dec(a.JID)
	a.TrackingActive = active == 1
	return a, nil
}

func (db *DB) GetAccountByJID(ctx context.Context, jid string) (Account, error) {
	var a Account
	var active int
	err := db.QueryRowContext(ctx,
		`SELECT id, jid, COALESCE(label,''), tracking_active, created_at FROM accounts WHERE jid=?`, db.enc(jid)).
		Scan(&a.ID, &a.JID, &a.Label, &active, &a.CreatedAt)
	if err != nil {
		return Account{}, err
	}
	a.JID = db.dec(a.JID)
	a.TrackingActive = active == 1
	return a, nil
}

func (db *DB) ListAccounts(ctx context.Context) ([]Account, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, jid, COALESCE(label,''), tracking_active, created_at FROM accounts ORDER BY created_at ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Account
	for rows.Next() {
		var a Account
		var active int
		if err := rows.Scan(&a.ID, &a.JID, &a.Label, &active, &a.CreatedAt); err != nil {
			return nil, err
		}
		a.JID = db.dec(a.JID)
		a.TrackingActive = active == 1
		out = append(out, a)
	}
	return out, rows.Err()
}

func (db *DB) UpdateAccount(ctx context.Context, id int64, label *string, trackingActive *bool) error {
	if label == nil && trackingActive == nil {
		return nil
	}
	q := "UPDATE accounts SET "
	args := []any{}
	first := true
	if label != nil {
		q += "label=?"
		args = append(args, *label)
		first = false
	}
	if trackingActive != nil {
		if !first {
			q += ", "
		}
		q += "tracking_active=?"
		args = append(args, boolToInt(*trackingActive))
	}
	q += " WHERE id=?"
	args = append(args, id)
	_, err := db.ExecContext(ctx, q, args...)
	return err
}

func (db *DB) DeleteAccount(ctx context.Context, id int64) error {
	_, err := db.ExecContext(ctx, `DELETE FROM accounts WHERE id=?`, id)
	return err
}

// BackfillAccountID sets account_id on contacts that have NULL account_id.
// Called on startup to migrate existing single-account installs.
func (db *DB) BackfillAccountID(ctx context.Context, accountID int64) error {
	_, err := db.ExecContext(ctx,
		`UPDATE contacts SET account_id=? WHERE account_id IS NULL`, accountID)
	return err
}

// --- Contact ----------------------------------------------------------------

type Contact struct {
	ID                int64  `json:"id"`
	AccountID         int64  `json:"-"`
	JID               string `json:"jid"`
	LID               string `json:"-"`
	Phone             string `json:"phone"`
	DisplayName       string `json:"displayName"`
	AddedAt           int64  `json:"addedAt"`
	TrackingEnabled   bool   `json:"trackingEnabled"`
	LatestPicturePath string `json:"latestPicturePath,omitempty"`
}

const contactCols = `id, COALESCE(account_id,0), jid, COALESCE(lid,''), phone, COALESCE(display_name,''), added_at, tracking_enabled,
	COALESCE((SELECT media_path FROM profile_picture_history WHERE contact_id=contacts.id AND media_path IS NOT NULL AND media_path!='' ORDER BY captured_at DESC LIMIT 1),'')`

func scanContact(row interface{ Scan(...any) error }) (Contact, error) {
	var c Contact
	var enabled int
	if err := row.Scan(&c.ID, &c.AccountID, &c.JID, &c.LID, &c.Phone, &c.DisplayName, &c.AddedAt, &enabled, &c.LatestPicturePath); err != nil {
		return Contact{}, err
	}
	c.TrackingEnabled = enabled == 1
	return c, nil
}

// decryptContact decrypts the encrypted fields of a contact.
func (db *DB) decryptContact(c Contact) Contact {
	c.JID = db.dec(c.JID)
	c.LID = db.dec(c.LID)
	c.Phone = db.dec(c.Phone)
	return c
}

func (db *DB) CountContacts(ctx context.Context, accountID int64) (int, error) {
	var n int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM contacts WHERE account_id=?`, accountID).Scan(&n)
	return n, err
}

func (db *DB) ListContacts(ctx context.Context, accountID int64, limit, offset int) ([]Contact, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT `+contactCols+` FROM contacts WHERE account_id=?
		 ORDER BY tracking_enabled DESC, added_at DESC
		 LIMIT ? OFFSET ?`, accountID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Contact
	for rows.Next() {
		c, err := scanContact(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, db.decryptContact(c))
	}
	return out, rows.Err()
}

func (db *DB) ListAllContacts(ctx context.Context, accountID int64) ([]Contact, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT `+contactCols+` FROM contacts WHERE account_id=?
		 ORDER BY tracking_enabled DESC, added_at DESC`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Contact
	for rows.Next() {
		c, err := scanContact(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, db.decryptContact(c))
	}
	return out, rows.Err()
}

func (db *DB) ListTrackedContacts(ctx context.Context, accountID int64) ([]Contact, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT `+contactCols+` FROM contacts WHERE account_id=? AND tracking_enabled=1`, accountID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Contact
	for rows.Next() {
		c, err := scanContact(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, db.decryptContact(c))
	}
	return out, rows.Err()
}

func (db *DB) GetContact(ctx context.Context, accountID, id int64) (Contact, error) {
	c, err := scanContact(db.QueryRowContext(ctx,
		`SELECT `+contactCols+` FROM contacts WHERE id=? AND account_id=?`, id, accountID))
	if err != nil {
		return Contact{}, err
	}
	return db.decryptContact(c), nil
}

func (db *DB) GetContactByJID(ctx context.Context, accountID int64, jid string) (Contact, error) {
	c, err := scanContact(db.QueryRowContext(ctx,
		`SELECT `+contactCols+` FROM contacts WHERE jid=? AND account_id=?`, db.enc(jid), accountID))
	if err != nil {
		return Contact{}, err
	}
	return db.decryptContact(c), nil
}

func (db *DB) GetContactByLID(ctx context.Context, accountID int64, lid string) (Contact, error) {
	c, err := scanContact(db.QueryRowContext(ctx,
		`SELECT `+contactCols+` FROM contacts WHERE lid=? AND account_id=?`, db.enc(lid), accountID))
	if err != nil {
		return Contact{}, err
	}
	return db.decryptContact(c), nil
}

func (db *DB) UpdateContactLID(ctx context.Context, id int64, lid string) error {
	_, err := db.ExecContext(ctx, `UPDATE contacts SET lid=? WHERE id=?`, db.enc(lid), id)
	return err
}

// UpsertContactUntracked inserts a contact with tracking disabled if no contact
// with that JID already exists for this account. Existing contacts are untouched.
func (db *DB) UpsertContactUntracked(ctx context.Context, accountID int64, jid, phone, name string) error {
	now := time.Now().Unix()
	_, err := db.ExecContext(ctx,
		`INSERT OR IGNORE INTO contacts (account_id, jid, phone, display_name, added_at, tracking_enabled)
		 VALUES (?, ?, ?, ?, ?, 0)`,
		accountID, db.enc(jid), db.enc(phone), name, now)
	return err
}

func (db *DB) InsertContact(ctx context.Context, accountID int64, jid, phone, name string) (Contact, error) {
	now := time.Now().Unix()
	res, err := db.ExecContext(ctx,
		`INSERT INTO contacts (account_id, jid, phone, display_name, added_at, tracking_enabled)
		 VALUES (?, ?, ?, ?, ?, 1)`, accountID, db.enc(jid), db.enc(phone), name, now)
	if err != nil {
		return Contact{}, err
	}
	id, _ := res.LastInsertId()
	return db.GetContact(ctx, accountID, id)
}

func (db *DB) UpdateContact(ctx context.Context, id int64, name *string, tracking *bool) error {
	if name == nil && tracking == nil {
		return nil
	}
	q := "UPDATE contacts SET "
	args := []any{}
	first := true
	if name != nil {
		q += "display_name=?"
		args = append(args, *name)
		first = false
	}
	if tracking != nil {
		if !first {
			q += ", "
		}
		q += "tracking_enabled=?"
		args = append(args, boolToInt(*tracking))
	}
	q += " WHERE id=?"
	args = append(args, id)
	_, err := db.ExecContext(ctx, q, args...)
	return err
}

func (db *DB) DeleteContact(ctx context.Context, id int64) error {
	_, err := db.ExecContext(ctx, `DELETE FROM contacts WHERE id=?`, id)
	return err
}

// --- Presence ---------------------------------------------------------------

type PresenceEvent struct {
	ID         int64  `json:"id"`
	ContactID  int64  `json:"contactId"`
	State      string `json:"state"`
	LastSeen   *int64 `json:"lastSeen,omitempty"`
	ObservedAt int64  `json:"observedAt"`
}

func (db *DB) InsertPresence(ctx context.Context, contactID int64, state string, lastSeen *int64, observedAt int64) (PresenceEvent, error) {
	res, err := db.ExecContext(ctx,
		`INSERT INTO presence_events (contact_id, state, last_seen, observed_at)
		 VALUES (?, ?, ?, ?)`, contactID, state, nullInt(lastSeen), observedAt)
	if err != nil {
		return PresenceEvent{}, err
	}
	id, _ := res.LastInsertId()
	return PresenceEvent{ID: id, ContactID: contactID, State: state, LastSeen: lastSeen, ObservedAt: observedAt}, nil
}

func (db *DB) LatestPresence(ctx context.Context, contactID int64) (PresenceEvent, error) {
	var e PresenceEvent
	var ls sql.NullInt64
	err := db.QueryRowContext(ctx,
		`SELECT id, contact_id, state, last_seen, observed_at
		   FROM presence_events WHERE contact_id=?
		   ORDER BY observed_at DESC LIMIT 1`, contactID).
		Scan(&e.ID, &e.ContactID, &e.State, &ls, &e.ObservedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return PresenceEvent{}, nil
	}
	if err != nil {
		return PresenceEvent{}, err
	}
	if ls.Valid {
		v := ls.Int64
		e.LastSeen = &v
	}
	return e, nil
}

// --- Picture / About --------------------------------------------------------

type PictureRecord struct {
	ID         int64  `json:"id"`
	ContactID  int64  `json:"contactId"`
	PictureID  string `json:"pictureId,omitempty"`
	URL        string `json:"url,omitempty"`
	SHA256     string `json:"sha256,omitempty"`
	MediaPath  string `json:"mediaPath,omitempty"`
	CapturedAt int64  `json:"capturedAt"`
}

type AboutRecord struct {
	ID         int64  `json:"id"`
	ContactID  int64  `json:"contactId"`
	Text       string `json:"text"`
	SetAt      *int64 `json:"setAt,omitempty"`
	CapturedAt int64  `json:"capturedAt"`
}

func (db *DB) LatestPicture(ctx context.Context, contactID int64) (PictureRecord, error) {
	var p PictureRecord
	var pid, url, sha, mp sql.NullString
	err := db.QueryRowContext(ctx,
		`SELECT id, contact_id, picture_id, url, sha256, COALESCE(media_path,''), captured_at
		   FROM profile_picture_history WHERE contact_id=?
		   ORDER BY captured_at DESC LIMIT 1`, contactID).
		Scan(&p.ID, &p.ContactID, &pid, &url, &sha, &mp, &p.CapturedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return PictureRecord{}, nil
	}
	if err != nil {
		return PictureRecord{}, err
	}
	p.PictureID = pid.String
	p.URL = url.String
	p.SHA256 = sha.String
	p.MediaPath = mp.String
	return p, nil
}

func (db *DB) InsertPicture(ctx context.Context, contactID int64, pictureID, url, sha256, mediaPath string, capturedAt int64) (PictureRecord, error) {
	res, err := db.ExecContext(ctx,
		`INSERT INTO profile_picture_history (contact_id, picture_id, url, sha256, media_path, captured_at)
		 VALUES (?, ?, ?, ?, ?, ?)`, contactID, nullStr(pictureID), nullStr(url), nullStr(sha256), nullStr(mediaPath), capturedAt)
	if err != nil {
		return PictureRecord{}, err
	}
	id, _ := res.LastInsertId()
	return PictureRecord{ID: id, ContactID: contactID, PictureID: pictureID, URL: url, SHA256: sha256, MediaPath: mediaPath, CapturedAt: capturedAt}, nil
}

func (db *DB) LatestAbout(ctx context.Context, contactID int64) (AboutRecord, error) {
	var a AboutRecord
	var txt sql.NullString
	var setAt sql.NullInt64
	err := db.QueryRowContext(ctx,
		`SELECT id, contact_id, text, set_at, captured_at
		   FROM about_history WHERE contact_id=?
		   ORDER BY captured_at DESC LIMIT 1`, contactID).
		Scan(&a.ID, &a.ContactID, &txt, &setAt, &a.CapturedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return AboutRecord{}, nil
	}
	if err != nil {
		return AboutRecord{}, err
	}
	a.Text = txt.String
	if setAt.Valid {
		v := setAt.Int64
		a.SetAt = &v
	}
	return a, nil
}

func (db *DB) InsertAbout(ctx context.Context, contactID int64, text string, setAt *int64, capturedAt int64) (AboutRecord, error) {
	res, err := db.ExecContext(ctx,
		`INSERT INTO about_history (contact_id, text, set_at, captured_at)
		 VALUES (?, ?, ?, ?)`, contactID, nullStr(text), nullInt(setAt), capturedAt)
	if err != nil {
		return AboutRecord{}, err
	}
	id, _ := res.LastInsertId()
	return AboutRecord{ID: id, ContactID: contactID, Text: text, SetAt: setAt, CapturedAt: capturedAt}, nil
}

// --- Stickers ---------------------------------------------------------------

// Sticker represents a deduplicated sticker image stored once across all accounts.
type Sticker struct {
	Hash      string `json:"hash"`
	Path      string `json:"path"`
	CreatedAt int64  `json:"createdAt"`
}

// UpsertSticker inserts a sticker record if the hash is not already known and
// returns the canonical record (either new or existing).
func (db *DB) UpsertSticker(ctx context.Context, hash, path string) (Sticker, error) {
	now := time.Now().Unix()
	_, err := db.ExecContext(ctx,
		`INSERT OR IGNORE INTO stickers (hash, path, created_at) VALUES (?, ?, ?)`,
		hash, path, now)
	if err != nil {
		return Sticker{}, err
	}
	return db.GetStickerByHash(ctx, hash)
}

// GetStickerByHash fetches a sticker by its SHA-256 hash.
func (db *DB) GetStickerByHash(ctx context.Context, hash string) (Sticker, error) {
	var s Sticker
	err := db.QueryRowContext(ctx,
		`SELECT hash, path, created_at FROM stickers WHERE hash=?`, hash).
		Scan(&s.Hash, &s.Path, &s.CreatedAt)
	return s, err
}

// --- Messages ---------------------------------------------------------------

type Message struct {
	ID              int64  `json:"id"`
	AccountID       int64  `json:"accountId"`
	ContactID       *int64 `json:"contactId,omitempty"`
	ChatJID         string `json:"chatJid"`
	MessageID       string `json:"messageId"`
	SenderJID       string `json:"senderJid"`
	IsFromMe        bool   `json:"isFromMe"`
	Timestamp       int64  `json:"timestamp"`
	Text            string `json:"text,omitempty"`
	MediaType       string `json:"mediaType,omitempty"`
	MediaPath       string `json:"mediaPath,omitempty"`
	StickerHash     string `json:"stickerHash,omitempty"`
	ReceivedAt      int64  `json:"receivedAt"`
	QuotedMessageID string `json:"quotedMessageId,omitempty"`
}

type MessageEvent struct {
	ID              int64  `json:"id"`
	AccountID       int64  `json:"accountId"`
	ContactID       *int64 `json:"contactId,omitempty"`
	TargetMessageID string `json:"targetMessageId"`
	Kind            string `json:"kind"`
	ActorJID        string `json:"actorJid"`
	IsFromMe        bool   `json:"isFromMe"`
	Emoji           string `json:"emoji,omitempty"`
	NewText         string `json:"newText,omitempty"`
	ObservedAt      int64  `json:"observedAt"`
}

func (db *DB) InsertMessage(ctx context.Context, m Message) (Message, error) {
	res, err := db.ExecContext(ctx,
		`INSERT OR IGNORE INTO messages
		 (account_id, contact_id, chat_jid, message_id, sender_jid, is_from_me, timestamp, text, media_type, media_path, sticker_hash, received_at, quoted_message_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		m.AccountID, nullInt64Ptr(m.ContactID), db.enc(m.ChatJID), m.MessageID,
		db.enc(m.SenderJID), boolToInt(m.IsFromMe), m.Timestamp,
		nullStr(m.Text), nullStr(m.MediaType), nullStr(m.MediaPath), nullStr(m.StickerHash), m.ReceivedAt, nullStr(m.QuotedMessageID))
	if err != nil {
		return Message{}, err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return Message{}, nil // duplicate, already inserted
	}
	m.ID, _ = res.LastInsertId()
	return m, nil
}

func (db *DB) ListMessages(ctx context.Context, contactID, before int64, limit int) ([]Message, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	q := `SELECT id, account_id, contact_id, chat_jid, message_id, sender_jid, is_from_me, timestamp, COALESCE(text,''), COALESCE(media_type,''), COALESCE(media_path,''), COALESCE(sticker_hash,''), received_at, COALESCE(quoted_message_id,'')
		   FROM messages WHERE contact_id=?`
	args := []any{contactID}
	if before > 0 {
		q += ` AND timestamp < ?`
		args = append(args, before)
	}
	q += ` ORDER BY timestamp DESC LIMIT ?`
	args = append(args, limit)

	rows, err := db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Message
	for rows.Next() {
		var m Message
		var cid sql.NullInt64
		var fromMe int
		if err := rows.Scan(&m.ID, &m.AccountID, &cid, &m.ChatJID, &m.MessageID,
			&m.SenderJID, &fromMe, &m.Timestamp, &m.Text, &m.MediaType, &m.MediaPath, &m.StickerHash, &m.ReceivedAt, &m.QuotedMessageID); err != nil {
			return nil, err
		}
		if cid.Valid {
			v := cid.Int64
			m.ContactID = &v
		}
		m.ChatJID = db.dec(m.ChatJID)
		m.SenderJID = db.dec(m.SenderJID)
		m.IsFromMe = fromMe == 1
		out = append(out, m)
	}
	return out, rows.Err()
}

func (db *DB) InsertMessageEvent(ctx context.Context, e MessageEvent) error {
	_, err := db.ExecContext(ctx,
		`INSERT INTO message_events
		 (account_id, contact_id, target_message_id, kind, actor_jid, is_from_me, emoji, new_text, observed_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.AccountID, nullInt64Ptr(e.ContactID), e.TargetMessageID, e.Kind,
		db.enc(e.ActorJID), boolToInt(e.IsFromMe),
		nullStr(e.Emoji), nullStr(e.NewText), e.ObservedAt)
	return err
}

func (db *DB) ListMessageEventsByContact(ctx context.Context, contactID int64) ([]MessageEvent, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, account_id, contact_id, target_message_id, kind, actor_jid,
		        is_from_me, COALESCE(emoji,''), COALESCE(new_text,''), observed_at
		   FROM message_events
		  WHERE contact_id=?
		  ORDER BY observed_at ASC`,
		contactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []MessageEvent
	for rows.Next() {
		var e MessageEvent
		var cid sql.NullInt64
		var fromMe int
		if err := rows.Scan(&e.ID, &e.AccountID, &cid, &e.TargetMessageID, &e.Kind,
			&e.ActorJID, &fromMe, &e.Emoji, &e.NewText, &e.ObservedAt); err != nil {
			return nil, err
		}
		if cid.Valid {
			v := cid.Int64
			e.ContactID = &v
		}
		e.ActorJID = db.dec(e.ActorJID)
		e.IsFromMe = fromMe == 1
		out = append(out, e)
	}
	return out, rows.Err()
}

// --- Stories ----------------------------------------------------------------

type Story struct {
	ID         int64  `json:"id"`
	AccountID  int64  `json:"accountId"`
	ContactID  *int64 `json:"contactId,omitempty"`
	SenderJID  string `json:"senderJid"`
	StoryID    string `json:"storyId"`
	MediaType  string `json:"mediaType,omitempty"`
	MediaPath  string `json:"mediaPath,omitempty"`
	Caption    string `json:"caption,omitempty"`
	PostedAt   int64  `json:"postedAt"`
	ReceivedAt int64  `json:"receivedAt"`
}

func (db *DB) InsertStory(ctx context.Context, s Story) (Story, error) {
	res, err := db.ExecContext(ctx,
		`INSERT OR IGNORE INTO stories
		 (account_id, contact_id, sender_jid, story_id, media_type, media_path, caption, posted_at, received_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.AccountID, nullInt64Ptr(s.ContactID), db.enc(s.SenderJID), s.StoryID,
		nullStr(s.MediaType), nullStr(s.MediaPath), nullStr(s.Caption),
		s.PostedAt, s.ReceivedAt)
	if err != nil {
		return Story{}, err
	}
	id, _ := res.LastInsertId()
	if id == 0 {
		return Story{}, nil // duplicate
	}
	s.ID = id
	return s, nil
}

// RepairStoryMessages moves any messages with chat_jid == "status@broadcast"
// from the messages table into the stories table. These were stored there due
// to a JID struct-equality bug in processHistoryMessage. Safe to call multiple
// times (INSERT OR IGNORE + per-row DELETE).
func (db *DB) RepairStoryMessages(ctx context.Context) (int, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, account_id, contact_id, sender_jid, message_id,
		        COALESCE(text,''), COALESCE(media_type,''), COALESCE(media_path,''),
		        timestamp, received_at, chat_jid
		 FROM messages`)
	if err != nil {
		return 0, err
	}

	type candidate struct {
		id         int64
		accountID  int64
		contactID  sql.NullInt64
		senderJID  string // already encrypted in DB
		messageID  string
		text       string
		mediaType  string
		mediaPath  string
		ts         int64
		receivedAt int64
		chatJID    string // already encrypted in DB
	}

	var hits []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.id, &c.accountID, &c.contactID, &c.senderJID,
			&c.messageID, &c.text, &c.mediaType, &c.mediaPath,
			&c.ts, &c.receivedAt, &c.chatJID); err != nil {
			rows.Close()
			return 0, err
		}
		if db.dec(c.chatJID) == "status@broadcast" {
			hits = append(hits, c)
		}
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	moved := 0
	for _, c := range hits {
		var cid any
		if c.contactID.Valid {
			cid = c.contactID.Int64
		}
		// senderJID is already stored encrypted — use it verbatim to avoid double-encryption.
		if _, err := db.ExecContext(ctx,
			`INSERT OR IGNORE INTO stories
			 (account_id, contact_id, sender_jid, story_id, media_type, media_path, caption, posted_at, received_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			c.accountID, cid, c.senderJID, c.messageID,
			nullStr(c.mediaType), nullStr(c.mediaPath), nullStr(c.text),
			c.ts, c.receivedAt,
		); err != nil {
			continue
		}
		if _, err := db.ExecContext(ctx, `DELETE FROM messages WHERE id=?`, c.id); err != nil {
			continue
		}
		moved++
	}
	return moved, nil
}

func (db *DB) ListStoriesByContact(ctx context.Context, contactID int64) ([]Story, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, account_id, contact_id, sender_jid, story_id,
		        COALESCE(media_type,''), COALESCE(media_path,''), COALESCE(caption,''),
		        posted_at, received_at
		   FROM stories
		  WHERE contact_id=?
		  ORDER BY posted_at DESC`,
		contactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Story
	for rows.Next() {
		var s Story
		var cid sql.NullInt64
		if err := rows.Scan(&s.ID, &s.AccountID, &cid, &s.SenderJID, &s.StoryID,
			&s.MediaType, &s.MediaPath, &s.Caption, &s.PostedAt, &s.ReceivedAt); err != nil {
			return nil, err
		}
		if cid.Valid {
			v := cid.Int64
			s.ContactID = &v
		}
		s.SenderJID = db.dec(s.SenderJID)
		out = append(out, s)
	}
	return out, rows.Err()
}

// --- Timeline ---------------------------------------------------------------

type TimelineKind string

const (
	KindPresence TimelineKind = "presence"
	KindPicture  TimelineKind = "picture"
	KindAbout    TimelineKind = "about"
	KindMessage  TimelineKind = "message"
)

type TimelineEntry struct {
	Kind      TimelineKind `json:"kind"`
	At        int64        `json:"at"`
	State     string       `json:"state,omitempty"`
	LastSeen  *int64       `json:"lastSeen,omitempty"`
	Text      string       `json:"text,omitempty"`
	PictureID string       `json:"pictureId,omitempty"`
	URL       string       `json:"url,omitempty"`
	MediaPath string       `json:"mediaPath,omitempty"`
	IsFromMe  bool         `json:"isFromMe,omitempty"`
	MediaType string       `json:"mediaType,omitempty"`
}

func (db *DB) Timeline(ctx context.Context, contactID, since int64) ([]TimelineEntry, error) {
	out := make([]TimelineEntry, 0, 64)

	pres, err := db.QueryContext(ctx,
		`SELECT state, last_seen, observed_at FROM presence_events
		   WHERE contact_id=? AND observed_at>=?
		   ORDER BY observed_at`, contactID, since)
	if err != nil {
		return nil, err
	}
	for pres.Next() {
		var e TimelineEntry
		e.Kind = KindPresence
		var ls sql.NullInt64
		if err := pres.Scan(&e.State, &ls, &e.At); err != nil {
			pres.Close()
			return nil, err
		}
		if ls.Valid {
			v := ls.Int64
			e.LastSeen = &v
		}
		out = append(out, e)
	}
	pres.Close()

	pics, err := db.QueryContext(ctx,
		`SELECT picture_id, url, COALESCE(media_path,''), captured_at FROM profile_picture_history
		   WHERE contact_id=? AND captured_at>=?
		   ORDER BY captured_at`, contactID, since)
	if err != nil {
		return nil, err
	}
	for pics.Next() {
		var e TimelineEntry
		e.Kind = KindPicture
		var pid, url, mp sql.NullString
		if err := pics.Scan(&pid, &url, &mp, &e.At); err != nil {
			pics.Close()
			return nil, err
		}
		e.PictureID = pid.String
		e.URL = url.String
		e.MediaPath = mp.String
		out = append(out, e)
	}
	pics.Close()

	abouts, err := db.QueryContext(ctx,
		`SELECT text, captured_at FROM about_history
		   WHERE contact_id=? AND captured_at>=?
		   ORDER BY captured_at`, contactID, since)
	if err != nil {
		return nil, err
	}
	for abouts.Next() {
		var e TimelineEntry
		e.Kind = KindAbout
		var txt sql.NullString
		if err := abouts.Scan(&txt, &e.At); err != nil {
			abouts.Close()
			return nil, err
		}
		e.Text = txt.String
		out = append(out, e)
	}
	abouts.Close()

	msgs, err := db.QueryContext(ctx,
		`SELECT text, media_type, media_path, is_from_me, timestamp FROM messages
		   WHERE contact_id=? AND timestamp>=?
		   ORDER BY timestamp`, contactID, since)
	if err != nil {
		return nil, err
	}
	for msgs.Next() {
		var e TimelineEntry
		e.Kind = KindMessage
		var txt, media, mpath sql.NullString
		var fromMe int
		if err := msgs.Scan(&txt, &media, &mpath, &fromMe, &e.At); err != nil {
			msgs.Close()
			return nil, err
		}
		e.Text = txt.String
		e.MediaType = media.String
		e.MediaPath = mpath.String
		e.IsFromMe = fromMe == 1
		out = append(out, e)
	}
	msgs.Close()

	sortByAt(out)
	return out, nil
}

// --- Stats ------------------------------------------------------------------

func (db *DB) PresenceRange(ctx context.Context, contactID, start, end int64) ([]PresenceEvent, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT id, contact_id, state, last_seen, observed_at
		   FROM presence_events
		   WHERE contact_id=? AND observed_at>=? AND observed_at<?
		   ORDER BY observed_at`, contactID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]PresenceEvent, 0, 64)
	for rows.Next() {
		var e PresenceEvent
		var ls sql.NullInt64
		if err := rows.Scan(&e.ID, &e.ContactID, &e.State, &ls, &e.ObservedAt); err != nil {
			return nil, err
		}
		if ls.Valid {
			v := ls.Int64
			e.LastSeen = &v
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (db *DB) LastPresenceBefore(ctx context.Context, contactID, t int64) (PresenceEvent, error) {
	var e PresenceEvent
	var ls sql.NullInt64
	err := db.QueryRowContext(ctx,
		`SELECT id, contact_id, state, last_seen, observed_at
		   FROM presence_events
		   WHERE contact_id=? AND observed_at<?
		   ORDER BY observed_at DESC LIMIT 1`, contactID, t).
		Scan(&e.ID, &e.ContactID, &e.State, &ls, &e.ObservedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return PresenceEvent{}, nil
	}
	if err != nil {
		return PresenceEvent{}, err
	}
	if ls.Valid {
		v := ls.Int64
		e.LastSeen = &v
	}
	return e, nil
}

func (db *DB) CountPictureChanges(ctx context.Context, contactID, start, end int64) (int, error) {
	var n int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM profile_picture_history
		   WHERE contact_id=? AND captured_at>=? AND captured_at<?`,
		contactID, start, end).Scan(&n)
	return n, err
}

func (db *DB) CountAboutChanges(ctx context.Context, contactID, start, end int64) (int, error) {
	var n int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM about_history
		   WHERE contact_id=? AND captured_at>=? AND captured_at<?`,
		contactID, start, end).Scan(&n)
	return n, err
}

// --- Users ------------------------------------------------------------------

type User struct {
	Username     string `json:"username"`
	PasswordHash string `json:"-"`
	CreatedAt    int64  `json:"createdAt"`
}

func (db *DB) UpsertUser(ctx context.Context, username, hash string) error {
	now := time.Now().Unix()
	_, err := db.ExecContext(ctx,
		`INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)
		 ON CONFLICT(username) DO UPDATE SET password_hash=excluded.password_hash`,
		username, hash, now)
	return err
}

func (db *DB) GetUser(ctx context.Context, username string) (User, error) {
	var u User
	err := db.QueryRowContext(ctx,
		`SELECT username, password_hash, created_at FROM users WHERE username=?`, username).
		Scan(&u.Username, &u.PasswordHash, &u.CreatedAt)
	return u, err
}

func (db *DB) DeleteUser(ctx context.Context, username string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM users WHERE username=?`, username)
	return err
}

func (db *DB) ListUsers(ctx context.Context) ([]string, error) {
	rows, err := db.QueryContext(ctx, `SELECT username FROM users ORDER BY username`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var u string
		if err := rows.Scan(&u); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func (db *DB) HasUsers(ctx context.Context) (bool, error) {
	var n int
	err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&n)
	return n > 0, err
}

// --- Helpers ----------------------------------------------------------------

func nullStr(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nullInt(p *int64) any {
	if p == nil {
		return nil
	}
	return *p
}

func nullInt64Ptr(p *int64) any {
	if p == nil {
		return nil
	}
	return *p
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func sortByAt(es []TimelineEntry) {
	for i := 1; i < len(es); i++ {
		j := i
		for j > 0 && es[j-1].At > es[j].At {
			es[j-1], es[j] = es[j], es[j-1]
			j--
		}
	}
}

// GetOldestContactMessage returns the earliest stored message for a contact.
// Returns an empty Message (zero ID) when no messages exist yet.
func (db *DB) GetOldestContactMessage(ctx context.Context, accountID, contactID int64) (Message, error) {
	row := db.QueryRowContext(ctx,
		`SELECT id, account_id, contact_id, chat_jid, message_id, sender_jid, is_from_me, timestamp,
		        COALESCE(text,''), COALESCE(media_type,''), COALESCE(media_path,''), received_at,
		        COALESCE(quoted_message_id,'')
		 FROM messages
		 WHERE account_id=? AND contact_id=?
		 ORDER BY timestamp ASC
		 LIMIT 1`,
		accountID, contactID,
	)
	var m Message
	var cid sql.NullInt64
	var fromMe int
	if err := row.Scan(&m.ID, &m.AccountID, &cid, &m.ChatJID, &m.MessageID,
		&m.SenderJID, &fromMe, &m.Timestamp, &m.Text, &m.MediaType, &m.MediaPath, &m.ReceivedAt, &m.QuotedMessageID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Message{}, nil
		}
		return Message{}, err
	}
	if cid.Valid {
		v := cid.Int64
		m.ContactID = &v
	}
	m.ChatJID = db.dec(m.ChatJID)
	m.SenderJID = db.dec(m.SenderJID)
	m.IsFromMe = fromMe == 1
	return m, nil
}
