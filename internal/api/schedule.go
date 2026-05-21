package api

import (
	"errors"
	"net/http"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

func (s *Server) handleGetSchedule(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	forceOffline, slots, err := s.db.GetAccountSchedule(r.Context(), accountID)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	if slots == nil {
		slots = []db.ScheduleSlot{}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"forceOffline": forceOffline,
		"slots":        slots,
	})
}

func (s *Server) handlePutSchedule(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	var body struct {
		ForceOffline bool             `json:"forceOffline"`
		Slots        []db.ScheduleSlot `json:"slots"`
	}
	if err := readJSON(r, &body); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	for _, s := range body.Slots {
		if s.StartMin < 0 || s.StartMin > 1439 || s.EndMin < 0 || s.EndMin > 1439 {
			writeErr(w, http.StatusBadRequest, errors.New("slot minutes must be in [0, 1439]"))
			return
		}
	}

	if err := s.db.SetAccountSchedule(r.Context(), accountID, body.ForceOffline, body.Slots); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	s.tracker.ApplySchedule(accountID, body.ForceOffline, body.Slots)

	writeJSON(w, http.StatusOK, map[string]any{
		"forceOffline": body.ForceOffline,
		"slots":        body.Slots,
	})
}
