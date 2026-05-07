package tracker

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"go.mau.fi/whatsmeow/types"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

const (
	minPollInterval = 5 * time.Second
	maxBackoff      = 5 * time.Minute
)

func (t *Tracker) runPictureLoop() {
	defer t.wg.Done()
	t.pollLoop(t.ctx, "picture", t.scanPictures)
}

func (t *Tracker) runAboutLoop() {
	defer t.wg.Done()
	t.pollLoop(t.ctx, "about", t.scanAbout)
}

func (t *Tracker) pollLoop(ctx context.Context, name string, scan func(context.Context)) {
	interval := t.interval
	if interval < minPollInterval {
		interval = minPollInterval
	}
	tick := time.NewTicker(interval)
	defer tick.Stop()
	// Run once immediately on connect, then on cadence.
	scan(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
			if !t.isRunning() || !t.wa.IsConnected() {
				continue
			}
			scan(ctx)
		}
	}
}

func (t *Tracker) scanPictures(ctx context.Context) {
	contacts, err := t.db.ListTrackedContacts(ctx)
	if err != nil {
		log.Printf("tracker: pic scan list: %v", err)
		return
	}
	if len(contacts) == 0 {
		return
	}
	gap := t.interval / time.Duration(len(contacts)+1)
	if gap < 100*time.Millisecond {
		gap = 100 * time.Millisecond
	}
	for _, c := range contacts {
		select {
		case <-ctx.Done():
			return
		default:
		}
		t.checkPicture(ctx, c)
		time.Sleep(gap)
	}
}

func (t *Tracker) scanAbout(ctx context.Context) {
	contacts, err := t.db.ListTrackedContacts(ctx)
	if err != nil {
		log.Printf("tracker: about scan list: %v", err)
		return
	}
	if len(contacts) == 0 {
		return
	}
	gap := t.interval / time.Duration(len(contacts)+1)
	if gap < 100*time.Millisecond {
		gap = 100 * time.Millisecond
	}
	for _, c := range contacts {
		select {
		case <-ctx.Done():
			return
		default:
		}
		t.checkAbout(ctx, c)
		time.Sleep(gap)
	}
}

func (t *Tracker) checkPicture(ctx context.Context, c db.Contact) {
	jid, err := types.ParseJID(c.JID)
	if err != nil {
		return
	}
	info, err := t.wa.GetProfilePicture(ctx, jid)
	if err != nil {
		// 404 / privacy: nothing to record.
		if !isExpectedErr(err) {
			log.Printf("tracker: get pic %s: %v", c.JID, err)
		}
		return
	}
	if info == nil {
		return
	}
	prev, _ := t.db.LatestPicture(ctx, c.ID)
	if prev.PictureID == info.ID && info.ID != "" {
		return
	}
	now := time.Now().Unix()
	rec, err := t.db.InsertPicture(ctx, c.ID, info.ID, info.URL, bytesHex(info.Hash), now)
	if err != nil {
		log.Printf("tracker: insert pic: %v", err)
		return
	}
	t.hub.Broadcast("picture", map[string]any{
		"contactId":  c.ID,
		"jid":        c.JID,
		"pictureId":  rec.PictureID,
		"url":        rec.URL,
		"capturedAt": rec.CapturedAt,
	})
}

func (t *Tracker) checkAbout(ctx context.Context, c db.Contact) {
	jid, err := types.ParseJID(c.JID)
	if err != nil {
		return
	}
	info, err := t.wa.GetUserInfo(ctx, []types.JID{jid})
	if err != nil {
		if !isExpectedErr(err) {
			log.Printf("tracker: get user %s: %v", c.JID, err)
		}
		return
	}
	u, ok := info[jid]
	if !ok {
		return
	}
	text := u.Status
	prev, _ := t.db.LatestAbout(ctx, c.ID)
	if prev.ID != 0 && prev.Text == text {
		return
	}
	now := time.Now().Unix()
	rec, err := t.db.InsertAbout(ctx, c.ID, text, nil, now)
	if err != nil {
		log.Printf("tracker: insert about: %v", err)
		return
	}
	t.hub.Broadcast("about", map[string]any{
		"contactId":  c.ID,
		"jid":        c.JID,
		"text":       rec.Text,
		"capturedAt": rec.CapturedAt,
	})
}

func isExpectedErr(err error) bool {
	if err == nil {
		return true
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
		return true
	}
	msg := strings.ToLower(err.Error())
	for _, m := range []string{"profile picture", "not found", "no picture", "404", "no status", "forbidden"} {
		if strings.Contains(msg, m) {
			return true
		}
	}
	return false
}
