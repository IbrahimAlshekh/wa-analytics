package api

import (
	"context"
	"encoding/json"
	"errors"
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
	flowCtx, cancel := context.WithTimeout(context.Background(), 3*time.Minute)
	codes, err := s.wa.StartQRFlow(flowCtx)
	if err != nil {
		cancel()
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	go func() {
		defer cancel()
		for code := range codes {
			s.hub.Broadcast("auth.qr", map[string]any{"code": code})
		}
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
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()
	code, err := s.wa.PairPhone(ctx, req.Phone)
	if err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"code": code})
}

func (s *Server) handleAuthLogout(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	if err := s.wa.Logout(ctx); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"ok": true})
}
