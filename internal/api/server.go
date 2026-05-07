package api

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/wa"
)

// Tracker is the interface the API uses to subscribe contacts to presence.
type Tracker interface {
	SubscribeContact(ctx context.Context, c db.Contact)
}

type Config struct {
	Bearer string
	Dev    bool
}

type Server struct {
	cfg     Config
	db      *db.DB
	manager *wa.ClientManager
	tracker Tracker
	hub     *Hub
	mux     *http.ServeMux
}

func NewServer(cfg Config, store *db.DB, manager *wa.ClientManager, trk Tracker, hub *Hub) *Server {
	s := &Server{cfg: cfg, db: store, manager: manager, tracker: trk, hub: hub}
	s.mux = http.NewServeMux()
	s.routes()
	return s
}

// responseWriter wraps http.ResponseWriter to capture the status code for logging.
// It also forwards http.Hijacker so WebSocket upgrades work correctly.
type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := rw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("underlying ResponseWriter does not implement http.Hijacker")
	}
	return h.Hijack()
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Dev {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
	}

	rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
	start := time.Now()
	s.mux.ServeHTTP(rw, r)
	dur := time.Since(start)

	level := slog.LevelInfo
	if rw.status >= 500 {
		level = slog.LevelError
	} else if rw.status >= 400 {
		level = slog.LevelWarn
	}
	slog.Log(r.Context(), level, "api request",
		"method", r.Method,
		"path", r.URL.Path,
		"status", rw.status,
		"duration_ms", dur.Milliseconds(),
	)
}

func (s *Server) routes() {
	apiAuth := func(h http.HandlerFunc) http.Handler { return s.requireAuth(http.HandlerFunc(h)) }

	// Accounts
	s.mux.Handle("GET /api/accounts", apiAuth(s.handleListAccounts))
	s.mux.Handle("POST /api/accounts/pair/qr", apiAuth(s.handlePairQR))
	s.mux.Handle("POST /api/accounts/pair/phone", apiAuth(s.handlePairPhone))
	s.mux.Handle("PATCH /api/accounts/{id}", apiAuth(s.handlePatchAccount))
	s.mux.Handle("DELETE /api/accounts/{id}", apiAuth(s.handleDeleteAccount))

	// Contacts (per-account)
	s.mux.Handle("GET /api/accounts/{id}/contacts", apiAuth(s.handleListContacts))
	s.mux.Handle("POST /api/accounts/{id}/contacts", apiAuth(s.handleCreateContact))
	s.mux.Handle("PATCH /api/accounts/{id}/contacts/{cid}", apiAuth(s.handlePatchContact))
	s.mux.Handle("DELETE /api/accounts/{id}/contacts/{cid}", apiAuth(s.handleDeleteContact))

	// Timeline / Stats / Messages (per-contact)
	s.mux.Handle("GET /api/accounts/{id}/contacts/{cid}/timeline", apiAuth(s.handleTimeline))
	s.mux.Handle("GET /api/accounts/{id}/contacts/{cid}/stats", apiAuth(s.handleStats))
	s.mux.Handle("GET /api/accounts/{id}/contacts/{cid}/messages", apiAuth(s.handleMessages))

	// WebSocket
	s.mux.Handle("GET /api/ws", apiAuth(s.handleWS))

	s.mux.Handle("/", staticHandler())
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	if s.cfg.Bearer == "" {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") || auth[len("Bearer "):] != s.cfg.Bearer {
			if r.URL.Query().Get("token") != s.cfg.Bearer {
				slog.Warn("unauthorized request", "method", r.Method, "path", r.URL.Path, "remote", r.RemoteAddr)
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, err error) {
	if status >= 500 {
		slog.Error("handler error", "status", status, "err", err)
	} else {
		slog.Warn("handler error", "status", status, "err", err)
	}
	writeJSON(w, status, map[string]string{"error": err.Error()})
}

func readJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

func parseID(r *http.Request) (int64, error) {
	v := r.PathValue("id")
	if v == "" {
		return 0, errors.New("missing id")
	}
	return strconv.ParseInt(v, 10, 64)
}

func parseCID(r *http.Request) (int64, error) {
	v := r.PathValue("cid")
	if v == "" {
		return 0, errors.New("missing cid")
	}
	return strconv.ParseInt(v, 10, 64)
}
