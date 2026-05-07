package db

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type Contact struct {
	ID              int64  `json:"id"`
	JID             string `json:"jid"`
	LID             string `json:"-"` // WhatsApp anonymous LID (not exposed in API)
	Phone           string `json:"phone"`
	DisplayName     string `json:"displayName"`
	AddedAt         int64  `json:"addedAt"`
	TrackingEnabled bool   `json:"trackingEnabled"`
}

type PresenceEvent struct {
	ID         int64  `json:"id"`
	ContactID  int64  `json:"contactId"`
	State      string `json:"state"`
	LastSeen   *int64 `json:"lastSeen,omitempty"`
	ObservedAt int64  `json:"observedAt"`
}

type PictureRecord struct {
	ID         int64  `json:"id"`
	ContactID  int64  `json:"contactId"`
	PictureID  string `json:"pictureId,omitempty"`
	URL        string `json:"url,omitempty"`
	SHA256     string `json:"sha256,omitempty"`
	CapturedAt int64  `json:"capturedAt"`
}

type AboutRecord struct {
	ID         int64  `json:"id"`
	ContactID  int64  `json:"contactId"`
	Text       string `json:"text"`
	SetAt      *int64 `json:"setAt,omitempty"`
	CapturedAt int64  `json:"capturedAt"`
}

type TimelineKind string

const (
	KindPresence TimelineKind = "presence"
	KindPicture  TimelineKind = "picture"
	KindAbout    TimelineKind = "about"
)

type TimelineEntry struct {
	Kind      TimelineKind `json:"kind"`
	At        int64        `json:"at"`
	State     string       `json:"state,omitempty"`
	LastSeen  *int64       `json:"lastSeen,omitempty"`
	Text      string       `json:"text,omitempty"`
	PictureID string       `json:"pictureId,omitempty"`
	URL       string       `json:"url,omitempty"`
}

// --- contacts -----------------------------------------------------------

const contactCols = `id, jid, COALESCE(lid,''), phone, COALESCE(display_name,''), added_at, tracking_enabled`

func scanContact(row interface{ Scan(...any) error }) (Contact, error) {
	var c Contact
	var enabled int
	if err := row.Scan(&c.ID, &c.JID, &c.LID, &c.Phone, &c.DisplayName, &c.AddedAt, &enabled); err != nil {
		return Contact{}, err
	}
	c.TrackingEnabled = enabled == 1
	return c, nil
}

func (db *DB) ListContacts(ctx context.Context) ([]Contact, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT `+contactCols+` FROM contacts ORDER BY added_at DESC`)
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
		out = append(out, c)
	}
	return out, rows.Err()
}

func (db *DB) ListTrackedContacts(ctx context.Context) ([]Contact, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT `+contactCols+` FROM contacts WHERE tracking_enabled=1`)
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
		out = append(out, c)
	}
	return out, rows.Err()
}

func (db *DB) GetContact(ctx context.Context, id int64) (Contact, error) {
	return scanContact(db.QueryRowContext(ctx,
		`SELECT `+contactCols+` FROM contacts WHERE id=?`, id))
}

func (db *DB) GetContactByJID(ctx context.Context, jid string) (Contact, error) {
	return scanContact(db.QueryRowContext(ctx,
		`SELECT `+contactCols+` FROM contacts WHERE jid=?`, jid))
}

func (db *DB) GetContactByLID(ctx context.Context, lid string) (Contact, error) {
	return scanContact(db.QueryRowContext(ctx,
		`SELECT `+contactCols+` FROM contacts WHERE lid=?`, lid))
}

func (db *DB) UpdateContactLID(ctx context.Context, id int64, lid string) error {
	_, err := db.ExecContext(ctx, `UPDATE contacts SET lid=? WHERE id=?`, lid, id)
	return err
}

func (db *DB) InsertContact(ctx context.Context, jid, phone, name string) (Contact, error) {
	now := time.Now().Unix()
	res, err := db.ExecContext(ctx,
		`INSERT INTO contacts (jid, phone, display_name, added_at, tracking_enabled)
		 VALUES (?, ?, ?, ?, 1)`, jid, phone, name, now)
	if err != nil {
		return Contact{}, err
	}
	id, _ := res.LastInsertId()
	return db.GetContact(ctx, id)
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

// --- presence -----------------------------------------------------------

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

// --- picture / about ----------------------------------------------------

func (db *DB) LatestPicture(ctx context.Context, contactID int64) (PictureRecord, error) {
	var p PictureRecord
	var pid, url, sha sql.NullString
	err := db.QueryRowContext(ctx,
		`SELECT id, contact_id, picture_id, url, sha256, captured_at
		   FROM profile_picture_history WHERE contact_id=?
		   ORDER BY captured_at DESC LIMIT 1`, contactID).
		Scan(&p.ID, &p.ContactID, &pid, &url, &sha, &p.CapturedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return PictureRecord{}, nil
	}
	if err != nil {
		return PictureRecord{}, err
	}
	p.PictureID = pid.String
	p.URL = url.String
	p.SHA256 = sha.String
	return p, nil
}

func (db *DB) InsertPicture(ctx context.Context, contactID int64, pictureID, url, sha256 string, capturedAt int64) (PictureRecord, error) {
	res, err := db.ExecContext(ctx,
		`INSERT INTO profile_picture_history (contact_id, picture_id, url, sha256, captured_at)
		 VALUES (?, ?, ?, ?, ?)`, contactID, nullStr(pictureID), nullStr(url), nullStr(sha256), capturedAt)
	if err != nil {
		return PictureRecord{}, err
	}
	id, _ := res.LastInsertId()
	return PictureRecord{ID: id, ContactID: contactID, PictureID: pictureID, URL: url, SHA256: sha256, CapturedAt: capturedAt}, nil
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

// --- timeline -----------------------------------------------------------

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
		`SELECT picture_id, url, captured_at FROM profile_picture_history
		   WHERE contact_id=? AND captured_at>=?
		   ORDER BY captured_at`, contactID, since)
	if err != nil {
		return nil, err
	}
	for pics.Next() {
		var e TimelineEntry
		e.Kind = KindPicture
		var pid, url sql.NullString
		if err := pics.Scan(&pid, &url, &e.At); err != nil {
			pics.Close()
			return nil, err
		}
		e.PictureID = pid.String
		e.URL = url.String
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

	// merge sort by At ascending
	sortByAt(out)
	return out, nil
}

// PresenceRange returns presence events for a contact in [start,end), ordered ascending.
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

// LastPresenceBefore returns the most recent presence event before t (or zero PresenceEvent).
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

// --- helpers ------------------------------------------------------------

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

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

func sortByAt(es []TimelineEntry) {
	// in-place insertion sort — fine for typical sizes (<10k)
	for i := 1; i < len(es); i++ {
		j := i
		for j > 0 && es[j-1].At > es[j].At {
			es[j-1], es[j] = es[j], es[j-1]
			j--
		}
	}
}
