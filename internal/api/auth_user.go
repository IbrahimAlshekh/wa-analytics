package api

import (
	"errors"
	"net/http"

	"golang.org/x/crypto/bcrypt"
)

type loginReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

type loginResp struct {
	Token string `json:"token"`
}

// dummyHash is a pre-computed bcrypt hash used to equalise response time when
// a username does not exist, preventing username enumeration via timing.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("dummy-timing-password"), bcrypt.DefaultCost)

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	ip := clientIP(r)
	if !s.limiter.allow(ip) {
		http.Error(w, "too many requests", http.StatusTooManyRequests)
		return
	}

	user, err := s.db.GetUser(r.Context(), req.Username)
	if err != nil {
		// User not found — run dummy bcrypt to equalise timing with the found-but-wrong-password path.
		_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(req.Password))
		s.limiter.record(ip)
		writeErr(w, http.StatusUnauthorized, errors.New("invalid credentials"))
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		s.limiter.record(ip)
		writeErr(w, http.StatusUnauthorized, errors.New("invalid credentials"))
		return
	}

	token, err := GenerateToken(user.Username, s.cfg.JWTKey)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, loginResp{Token: token})
}
