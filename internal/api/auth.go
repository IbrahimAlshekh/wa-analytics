package api

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"
)

func (s *Server) handleAuthStatus(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"linked":    s.wa.IsLoggedIn(),
		"connected": s.wa.IsConnected(),
		"ownJID":    s.wa.OwnJID(),
	})
}

func (s *Server) handleAuthQR(w http.ResponseWriter, r *http.Request) {
	if s.wa.IsLoggedIn() {
		writeErr(w, http.StatusConflict, errors.New("already linked"))
		return
	}
	slog.Info("auth: starting QR flow")
	flowCtx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	codes, err := s.wa.StartQRFlow(flowCtx)
	if err != nil {
		cancel()
		slog.Warn("auth: QR flow start failed", "err", err)
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	go func() {
		defer cancel()
		n := 0
		for code := range codes {
			n++
			slog.Debug("auth: QR code generated", "seq", n)
			s.hub.Broadcast("auth.qr", map[string]any{"code": code})
		}
		slog.Info("auth: QR flow ended", "codes_sent", n)
	}()
	writeJSON(w, http.StatusAccepted, map[string]any{"started": true})
}

type phoneReq struct {
	Phone string `json:"phone"`
}

func (s *Server) handleAuthPhone(w http.ResponseWriter, r *http.Request) {
	if s.wa.IsLoggedIn() {
		writeErr(w, http.StatusConflict, errors.New("already linked"))
		return
	}
	var req phoneReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if req.Phone == "" {
		writeErr(w, http.StatusBadRequest, errors.New("phone required"))
		return
	}
	slog.Info("auth: pairing phone", "phone", req.Phone)
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	code, err := s.wa.PairPhone(ctx, req.Phone)
	if err != nil {
		slog.Warn("auth: phone pair failed", "phone", req.Phone, "err", err)
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	slog.Info("auth: phone pair code issued", "phone", req.Phone)
	writeJSON(w, http.StatusOK, map[string]string{"code": code})
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	slog.Info("auth: logout requested")
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := s.wa.Logout(ctx); err != nil {
		slog.Error("auth: logout failed", "err", err)
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	slog.Info("auth: logged out successfully")
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
