package api

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
)

type createContactReq struct {
	Phone       string `json:"phone"`
	DisplayName string `json:"displayName"`
}

type patchContactReq struct {
	DisplayName     *string `json:"displayName,omitempty"`
	TrackingEnabled *bool   `json:"trackingEnabled,omitempty"`
}

func (s *Server) handleListContacts(w http.ResponseWriter, r *http.Request) {
	contacts, err := s.db.ListContacts(r.Context())
	if err != nil {
		slog.Error("contacts: list failed", "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	slog.Debug("contacts: listed", "count", len(contacts))
	if contacts == nil {
		writeJSON(w, http.StatusOK, []any{})
		return
	}
	writeJSON(w, http.StatusOK, contacts)
}

func (s *Server) handleCreateContact(w http.ResponseWriter, r *http.Request) {
	var req createContactReq
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if strings.TrimSpace(req.Phone) == "" {
		writeErr(w, http.StatusBadRequest, errors.New("phone required"))
		return
	}
	jid, err := wajid(req.Phone)
	if err != nil {
		slog.Warn("contacts: invalid phone", "phone", req.Phone, "err", err)
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	contact, err := s.db.InsertContact(r.Context(), jid, req.Phone, strings.TrimSpace(req.DisplayName))
	if err != nil {
		slog.Error("contacts: insert failed", "phone", req.Phone, "err", err)
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	slog.Info("contacts: created", "id", contact.ID, "phone", contact.Phone, "jid", contact.JID)
	go s.tracker.SubscribeContact(context.Background(), contact)
	writeJSON(w, http.StatusCreated, contact)
}

func (s *Server) handlePatchContact(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	var req patchContactReq
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.db.UpdateContact(r.Context(), id, req.DisplayName, req.TrackingEnabled); err != nil {
		slog.Error("contacts: update failed", "id", id, "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	contact, err := s.db.GetContact(r.Context(), id)
	if err != nil {
		slog.Warn("contacts: get after update failed", "id", id, "err", err)
		writeErr(w, http.StatusNotFound, err)
		return
	}
	slog.Info("contacts: patched", "id", id, "tracking_enabled", contact.TrackingEnabled)
	if req.TrackingEnabled != nil && *req.TrackingEnabled {
		go s.tracker.SubscribeContact(context.Background(), contact)
	}
	writeJSON(w, http.StatusOK, contact)
}

func (s *Server) handleDeleteContact(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.db.DeleteContact(r.Context(), id); err != nil {
		slog.Error("contacts: delete failed", "id", id, "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	slog.Info("contacts: deleted", "id", id)
	w.WriteHeader(http.StatusNoContent)
}
