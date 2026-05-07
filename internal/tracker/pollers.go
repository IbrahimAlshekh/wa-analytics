package tracker

import (
	"context"
	"errors"
	"log/slog"
	"strings"
	"time"

	"go.mau.fi/whatsmeow/types"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/config"
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
	slog.Info("tracker: poll loop started", "name", name, "interval", interval)
	// Run once immediately on connect, then on cadence.
	scan(ctx)
	for {
		select {
		case <-ctx.Done():
			slog.Info("tracker: poll loop stopped", "name", name)
			return
		case <-tick.C:
			if !t.isRunning() || !t.wa.IsConnected() || t.checkBackoff() {
				continue
			}
			scan(ctx)
		}
	}
}

func (t *Tracker) checkBackoff() bool {
	t.backoffMu.RLock()
	defer t.backoffMu.RUnlock()
	return time.Now().Before(t.backoffUntil)
}

func (t *Tracker) setBackoff(d time.Duration) {
	t.backoffMu.Lock()
	t.backoffUntil = time.Now().Add(d)
	t.backoffMu.Unlock()
	slog.Log(t.ctx, config.LevelAudit, "tracker: entered rate-limit backoff", "duration", d, "until", t.backoffUntil)
}

func (t *Tracker) scanPictures(ctx context.Context) {
	contacts, err := t.db.ListTrackedContacts(ctx, t.accountID)
	if err != nil {
		slog.Error("tracker: picture scan — list contacts failed", "accountID", t.accountID, "err", err)
		return
	}
	if len(contacts) == 0 {
		return
	}
	slog.Debug("tracker: scanning pictures", "contacts", len(contacts))
	gap := t.interval / time.Duration(len(contacts)+1)
	if gap < 200*time.Millisecond {
		gap = 200 * time.Millisecond
	}
	for _, c := range contacts {
		select {
		case <-ctx.Done():
			return
		default:
		}
		if t.checkBackoff() {
			return
		}
		t.checkPicture(ctx, c)
		time.Sleep(gap)
	}
}

func (t *Tracker) scanAbout(ctx context.Context) {
	contacts, err := t.db.ListTrackedContacts(ctx, t.accountID)
	if err != nil {
		slog.Error("tracker: about scan — list contacts failed", "accountID", t.accountID, "err", err)
		return
	}
	if len(contacts) == 0 {
		return
	}
	slog.Debug("tracker: scanning about (batch)", "contacts", len(contacts))

	jids := make([]types.JID, 0, len(contacts))
	for _, c := range contacts {
		if jid, err := types.ParseJID(c.JID); err == nil {
			jids = append(jids, jid)
		}
	}

	info, err := t.wa.GetUserInfo(ctx, jids)
	if err != nil {
		if isRateLimit(err) {
			slog.Log(ctx, config.LevelAudit, "tracker: rate limited on batch user info", "accountID", t.accountID, "err", err)
			t.setBackoff(5 * time.Minute)
		} else if !isExpectedErr(err) {
			slog.Warn("tracker: batch get user info failed", "accountID", t.accountID, "err", err)
		}
		return
	}

	for _, c := range contacts {
		jid, _ := types.ParseJID(c.JID)
		if u, ok := info[jid]; ok {
			t.processAbout(ctx, c, u.Status)
		}
	}
}

func (t *Tracker) checkPicture(ctx context.Context, c db.Contact) {
	jid, err := types.ParseJID(c.JID)
	if err != nil {
		return
	}
	info, err := t.wa.GetProfilePicture(ctx, jid)
	if err != nil {
		if isRateLimit(err) {
			slog.Log(ctx, config.LevelAudit, "tracker: rate limited on profile picture", "jid", c.JID, "err", err)
			t.setBackoff(5 * time.Minute)
		} else if !isExpectedErr(err) {
			slog.Warn("tracker: get profile picture failed", "jid", c.JID, "err", err)
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
		slog.Error("tracker: insert picture failed", "jid", c.JID, "contact_id", c.ID, "err", err)
		return
	}
	slog.Info("tracker: picture changed", "jid", c.JID, "contact_id", c.ID, "picture_id", rec.PictureID)
	t.hub.Broadcast("picture", map[string]any{
		"contactId":  c.ID,
		"jid":        c.JID,
		"pictureId":  rec.PictureID,
		"url":        rec.URL,
		"capturedAt": rec.CapturedAt,
	})
}

func (t *Tracker) processAbout(ctx context.Context, c db.Contact, text string) {
	prev, _ := t.db.LatestAbout(ctx, c.ID)
	if prev.ID != 0 && prev.Text == text {
		return
	}
	now := time.Now().Unix()
	rec, err := t.db.InsertAbout(ctx, c.ID, text, nil, now)
	if err != nil {
		slog.Error("tracker: insert about failed", "jid", c.JID, "contact_id", c.ID, "err", err)
		return
	}
	slog.Info("tracker: about changed", "jid", c.JID, "contact_id", c.ID, "text", rec.Text)
	t.hub.Broadcast("about", map[string]any{
		"contactId":  c.ID,
		"jid":        c.JID,
		"text":       rec.Text,
		"capturedAt": rec.CapturedAt,
	})
}

func isRateLimit(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "rate") || strings.Contains(msg, "too many") || strings.Contains(msg, "429") || strings.Contains(msg, "backoff") || strings.Contains(msg, "blocked")
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
