package api

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/stats"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/wa"
)

func (s *Server) handleTimeline(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	cid, err := parseCID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	since := int64(0)
	if v := r.URL.Query().Get("since"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			since = n
		}
	}
	contact, err := s.db.GetContact(r.Context(), accountID, cid)
	if err != nil {
		slog.Warn("timeline: contact not found", "accountID", accountID, "id", cid, "err", err)
		writeErr(w, http.StatusNotFound, err)
		return
	}
	entries, err := s.db.Timeline(r.Context(), cid, since)
	if err != nil {
		slog.Error("timeline: query failed", "accountID", accountID, "id", cid, "since", since, "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if entries == nil {
		entries = []db.TimelineEntry{}
	}
	slog.Debug("timeline: fetched", "accountID", accountID, "contact_id", cid, "entries", len(entries), "since", since)
	writeJSON(w, http.StatusOK, map[string]any{
		"contact": contact,
		"entries": entries,
	})
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	cid, err := parseCID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	// Verify contact belongs to account.
	if _, err := s.db.GetContact(r.Context(), accountID, cid); err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	rng := r.URL.Query().Get("range")
	if rng == "" {
		rng = "today"
	}
	out, err := stats.Compute(r.Context(), s.db, cid, rng, time.Now())
	if err != nil {
		slog.Warn("stats: compute failed", "accountID", accountID, "contact_id", cid, "range", rng, "err", err)
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	slog.Debug("stats: computed", "accountID", accountID, "contact_id", cid, "range", rng, "online_seconds", out.OnlineSecondsAll)
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) handleMessages(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	cid, err := parseCID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	// Verify contact belongs to account.
	if _, err := s.db.GetContact(r.Context(), accountID, cid); err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	before := int64(0)
	if v := r.URL.Query().Get("before"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			before = n
		}
	}
	limit := 50
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			limit = n
		}
	}
	msgs, err := s.db.ListMessages(r.Context(), cid, before, limit)
	if err != nil {
		slog.Error("messages: list failed", "accountID", accountID, "contact_id", cid, "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if msgs == nil {
		msgs = []db.Message{}
	}
	slog.Debug("messages: listed", "accountID", accountID, "contact_id", cid, "count", len(msgs))
	writeJSON(w, http.StatusOK, msgs)
}

// wajid converts a phone number to a JID string.
func wajid(phone string) (string, error) {
	jid, err := wa.JIDFromPhone(phone)
	if err != nil {
		return "", err
	}
	return jid.String(), nil
}
