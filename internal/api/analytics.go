package api

import (
	"net/http"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/analytics"
)

func (s *Server) handleAnalytics(w http.ResponseWriter, r *http.Request) {
	accountID, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	contactID, err := parseCID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	// Verify contact belongs to account.
	if _, err := s.db.GetContact(r.Context(), accountID, contactID); err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}

	rangeName := r.URL.Query().Get("range")
	if rangeName == "" {
		rangeName = "day"
	}

	rpt, err := analytics.Compute(r.Context(), s.db, contactID, rangeName, time.Now())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, rpt)
}
