package api

import (
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

func (s *Server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := readJSON(r, &req); err != nil {
		writeErr(w, http.StatusBadRequest, err)
		return
	}

	user, err := s.db.GetUser(r.Context(), req.Username)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		writeErr(w, http.StatusUnauthorized, err)
		return
	}

	token, err := GenerateToken(user.Username)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}

	writeJSON(w, http.StatusOK, loginResp{Token: token})
}
