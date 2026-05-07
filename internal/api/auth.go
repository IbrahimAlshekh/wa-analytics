package api

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/config"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

// handleListAccounts returns all paired accounts with live connection status.
func (s *Server) handleListAccounts(w http.ResponseWriter, r *http.Request) {
	accounts, err := s.db.ListAccounts(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if accounts == nil {
		accounts = []db.Account{}
	}
	type accountResp struct {
		db.Account
		Connected bool `json:"connected"`
	}
	out := make([]accountResp, len(accounts))
	for i, a := range accounts {
		out[i] = accountResp{
			Account:   a,
			Connected: s.manager.IsConnected(a.ID),
		}
	}
	writeJSON(w, http.StatusOK, out)
}

// handlePairQR starts a QR pairing flow for a new account.
func (s *Server) handlePairQR(w http.ResponseWriter, r *http.Request) {
	slog.Log(r.Context(), config.LevelAudit, "accounts: starting QR pairing flow")
	flowCtx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	codes, err := s.manager.StartQRPairing(flowCtx)
	if err != nil {
		cancel()
		slog.Log(r.Context(), config.LevelAudit, "accounts: QR flow start failed", "err", err)
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	go func() {
		defer cancel()
		n := 0
		for code := range codes {
			n++
			slog.Debug("accounts: QR code generated", "seq", n)
			s.hub.Broadcast("auth.qr", map[string]any{"code": code})
		}
		slog.Log(context.Background(), config.LevelAudit, "accounts: QR flow ended", "codes_sent", n)
	}()
	writeJSON(w, http.StatusAccepted, map[string]any{"started": true})
}

// handlePairPhone starts a phone-number pairing flow for a new account.
func (s *Server) handlePairPhone(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Phone string `json:"phone"`
	}
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if req.Phone == "" {
		writeErr(w, http.StatusBadRequest, errors.New("phone required"))
		return
	}
	slog.Log(r.Context(), config.LevelAudit, "accounts: pairing by phone", "phone", req.Phone)
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	code, err := s.manager.PairPhone(ctx, req.Phone)
	if err != nil {
		slog.Log(r.Context(), config.LevelAudit, "accounts: phone pair failed", "phone", req.Phone, "err", err)
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	slog.Log(r.Context(), config.LevelAudit, "accounts: phone pair code issued", "phone", req.Phone)
	writeJSON(w, http.StatusOK, map[string]string{"code": code})
}

// handlePatchAccount updates label or tracking_active for an account.
func (s *Server) handlePatchAccount(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	var req struct {
		Label          *string `json:"label,omitempty"`
		TrackingActive *bool   `json:"trackingActive,omitempty"`
	}
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if err := s.db.UpdateAccount(r.Context(), id, req.Label, req.TrackingActive); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	acc, err := s.db.GetAccount(r.Context(), id)
	if err != nil {
		writeErr(w, http.StatusNotFound, err)
		return
	}
	slog.Info("accounts: patched", "id", id)
	writeJSON(w, http.StatusOK, acc)
}

// handleDeleteAccount removes an account and all its data.
func (s *Server) handleDeleteAccount(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	// Remove from WA manager (disconnects + deletes whatsmeow device).
	if err := s.manager.Remove(r.Context(), id); err != nil {
		slog.Log(r.Context(), config.LevelAudit, "accounts: manager remove failed (device may already be gone)", "id", id, "err", err)
	}
	if err := s.db.DeleteAccount(r.Context(), id); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	slog.Log(r.Context(), config.LevelAudit, "accounts: deleted", "id", id)
	w.WriteHeader(http.StatusNoContent)
}
