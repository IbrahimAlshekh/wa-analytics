package api

import (
	"errors"
	"fmt"
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

	q := r.URL.Query()
	start, end := q.Get("start"), q.Get("end")

	var rpt analytics.Report
	if start != "" || end != "" {
		if err := validateCustomRange(start, end); err != nil {
			writeErr(w, http.StatusBadRequest, err)
			return
		}
		rpt, err = analytics.ComputeCustom(r.Context(), s.db, contactID, start, end)
	} else {
		rangeName := q.Get("range")
		if rangeName == "" {
			rangeName = "week"
		}
		rpt, err = analytics.Compute(r.Context(), s.db, contactID, rangeName, time.Now())
	}
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, rpt)
}

func validateCustomRange(start, end string) error {
	const layout = "2006-01-02"
	if start == "" || end == "" {
		return errors.New("both start and end dates are required for a custom range")
	}
	s, err := time.ParseInLocation(layout, start, time.Local)
	if err != nil {
		return fmt.Errorf("invalid start date %q: must be YYYY-MM-DD", start)
	}
	e, err := time.ParseInLocation(layout, end, time.Local)
	if err != nil {
		return fmt.Errorf("invalid end date %q: must be YYYY-MM-DD", end)
	}
	if e.Before(s) {
		return errors.New("end date must be on or after start date")
	}
	return nil
}
