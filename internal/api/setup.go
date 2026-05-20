package api

import (
	"errors"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

// handleSetupStatus returns whether any users exist. Unauthenticated.
func (s *Server) handleSetupStatus(w http.ResponseWriter, r *http.Request) {
	has, err := s.db.HasUsers(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"hasUsers": has})
}

type registerReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// handleSetupRegister creates the first user. Rejects if any user already exists.
func (s *Server) handleSetupRegister(w http.ResponseWriter, r *http.Request) {
	has, err := s.db.HasUsers(r.Context())
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if has {
		writeErr(w, http.StatusForbidden, errors.New("registration is closed"))
		return
	}

	var req registerReq
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}
	if req.Username == "" || req.Password == "" {
		writeErr(w, http.StatusBadRequest, errors.New("username and password required"))
		return
	}
	if len(req.Password) < 8 {
		writeErr(w, http.StatusBadRequest, errors.New("password must be at least 8 characters"))
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	if err := s.db.UpsertUser(r.Context(), req.Username, string(hash)); err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	token, err := GenerateToken(req.Username, s.cfg.JWTKey)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusCreated, loginResp{Token: token})
}
