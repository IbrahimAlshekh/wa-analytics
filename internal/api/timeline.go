package api

import (
	"net/http"
	"strconv"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/stats"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/wa"
)

func (s *Server) handleTimeline(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
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
	contact, err := s.db.GetContact(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	entries, err := s.db.Timeline(r.Context(), id, since)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if entries == nil {
		entries = []db.TimelineEntry{}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"contact": contact,
		"entries": entries,
	})
}

func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	rng := r.URL.Query().Get("range")
	if rng == "" {
		rng = "today"
	}
	out, err := stats.Compute(r.Context(), s.db, id, rng, time.Now())
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

// wajid is a tiny helper that converts a phone to a JID string.
func wajid(phone string) (string, error) {
	jid, err := wa.JIDFromPhone(phone)
	if err != nil {
		return "", err
	}
	return jid.String(), nil
}

