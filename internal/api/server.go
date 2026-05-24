package api

import (
	"bufio"
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	whatsmeow "go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

// Tracker is the interface the API uses to subscribe contacts to presence and manage scheduling.
type Tracker interface {
	SubscribeContact(ctx context.Context, c db.Contact)
	ApplySchedule(accountID int64, forceOffline bool, slots []db.ScheduleSlot)
	RefreshContactPicture(accountID, contactID int64)
}

// WAClientForAPI is the subset of wa.Client methods used by API handlers.
// *wa.Client satisfies this interface; tests use a hand-rolled fake.
type WAClientForAPI interface {
	IsConnected() bool
	OwnJID() string
	SendMessage(ctx context.Context, to types.JID, msg *waE2E.Message) (whatsmeow.SendResponse, error)
	UploadMedia(ctx context.Context, data []byte, appMessageType whatsmeow.MediaType) (whatsmeow.UploadResponse, error)
	FetchMessageHistory(ctx context.Context, info *types.MessageInfo) error
	GetAllContacts(ctx context.Context) (map[types.JID]types.ContactInfo, error)
}

// WAManager manages per-account WhatsApp clients.
// *wa.ClientManager satisfies this via the adapter in cmd/tracker/main.go.
type WAManager interface {
	GetByAccountID(id int64) WAClientForAPI
	IsConnected(accountID int64) bool
	StartQRPairing(ctx context.Context) (<-chan string, error)
	PairPhone(ctx context.Context, phone string) (string, error)
	Remove(ctx context.Context, accountID int64) error
}

// Config holds runtime configuration for the API server.
type Config struct {
	Bearer   string
	Dev      bool
	JWTKey   []byte // signing key for JWT tokens, derived from the app key
	DataDir  string
	MediaDir string
}

// Server handles all HTTP API and WebSocket requests.
type Server struct {
	cfg     Config
	db      *db.DB
	manager WAManager
	tracker Tracker
	hub     *Hub
	mux     *http.ServeMux
	limiter *rateLimiter
}

func NewServer(cfg Config, store *db.DB, manager WAManager, trk Tracker, hub *Hub) *Server {
	s := &Server{
		cfg:     cfg,
		db:      store,
		manager: manager,
		tracker: trk,
		hub:     hub,
		limiter: newRateLimiter(),
	}
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
	// Security headers on every response.
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
	w.Header().Set("X-XSS-Protection", "0")

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
	s.mux.Handle("POST /api/accounts/{id}/contacts/sync", apiAuth(s.handleSyncContacts))
	s.mux.Handle("PATCH /api/accounts/{id}/contacts/{cid}", apiAuth(s.handlePatchContact))
	s.mux.Handle("DELETE /api/accounts/{id}/contacts/{cid}", apiAuth(s.handleDeleteContact))

	// Schedule (per-account)
	s.mux.Handle("GET /api/accounts/{id}/schedule", apiAuth(s.handleGetSchedule))
	s.mux.Handle("PUT /api/accounts/{id}/schedule", apiAuth(s.handlePutSchedule))

	// Timeline / Stats / Messages / Analytics (per-contact)
	s.mux.Handle("GET /api/accounts/{id}/contacts/{cid}/timeline", apiAuth(s.handleTimeline))
	s.mux.Handle("GET /api/accounts/{id}/contacts/{cid}/stats", apiAuth(s.handleStats))
	s.mux.Handle("GET /api/accounts/{id}/contacts/{cid}/analytics", apiAuth(s.handleAnalytics))
	s.mux.Handle("GET /api/accounts/{id}/contacts/{cid}/messages", apiAuth(s.handleMessages))
	s.mux.Handle("POST /api/accounts/{id}/contacts/{cid}/messages", apiAuth(s.handleSendMessage))
	s.mux.Handle("POST /api/accounts/{id}/contacts/{cid}/messages/fetch-history", apiAuth(s.handleFetchMessageHistory))
	s.mux.Handle("GET /api/accounts/{id}/contacts/{cid}/stories", apiAuth(s.handleListStories))
	s.mux.Handle("POST /api/accounts/{id}/contacts/{cid}/refresh-picture", apiAuth(s.handleRefreshPicture))

	// Media (protected)
	if s.cfg.MediaDir != "" {
		s.mux.Handle("GET /media/", apiAuth(func(w http.ResponseWriter, r *http.Request) {
			http.StripPrefix("/media/", http.FileServer(http.Dir(s.cfg.MediaDir))).ServeHTTP(w, r)
		}))
	}

	// WebSocket (auth handled inside handleWS via first-message handshake)
	s.mux.HandleFunc("GET /api/ws", s.handleWS)

	// Auth
	s.mux.HandleFunc("POST /api/login", s.handleLogin)
	s.mux.Handle("POST /api/refresh", apiAuth(s.handleRefresh))

	// Backup
	s.mux.Handle("GET /api/backup", apiAuth(s.handleBackup))

	// Setup (unauthenticated — only active before any user exists)
	s.mux.HandleFunc("GET /api/setup/status", s.handleSetupStatus)
	s.mux.HandleFunc("POST /api/setup/register", s.handleSetupRegister)

	s.mux.Handle("/", staticHandler())
}

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		tokenStr := ""

		if strings.HasPrefix(auth, "Bearer ") {
			tokenStr = auth[len("Bearer "):]
		} else {
			// Fallback to ?token= for media tags (<img>, <video>)
			tokenStr = r.URL.Query().Get("token")
		}

		// 1. Check static bearer token (legacy/system access).
		if s.cfg.Bearer != "" && tokenStr != "" {
			provided := []byte(tokenStr)
			expected := []byte(s.cfg.Bearer)
			if subtle.ConstantTimeCompare(provided, expected) == 1 {
				next.ServeHTTP(w, r)
				return
			}
		}

		// 2. Check JWT token.
		if tokenStr != "" {
			if username, err := ValidateToken(tokenStr, s.cfg.JWTKey); err == nil && username != "" {
				next.ServeHTTP(w, r)
				return
			}
		}

		slog.Warn("unauthorized request", "method", r.Method, "path", r.URL.Path, "remote", r.RemoteAddr)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	})
}

// handleRefresh issues a fresh token for an already-authenticated user.
func (s *Server) handleRefresh(w http.ResponseWriter, r *http.Request) {
	auth := r.Header.Get("Authorization")
	username, err := ValidateToken(auth[len("Bearer "):], s.cfg.JWTKey)
	if err != nil {
		writeErr(w, http.StatusUnauthorized, err)
		return
	}
	token, err := GenerateToken(username, s.cfg.JWTKey)
	if err != nil {
		writeErr(w, http.StatusInternalServerError, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"token": token})
}

// clientIP extracts the remote IP from a request, stripping the port.
func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
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
	r.Body = http.MaxBytesReader(nil, r.Body, 1<<20) // 1 MB max
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

// --- Rate limiter -----------------------------------------------------------

const (
	rateLimitWindow   = 15 * time.Minute
	rateLimitMaxFails = 5
	rateLimitCleanup  = 5 * time.Minute
)

type rateLimiter struct {
	mu       sync.Mutex
	attempts map[string][]time.Time
}

func newRateLimiter() *rateLimiter {
	rl := &rateLimiter{attempts: make(map[string][]time.Time)}
	go rl.cleanupLoop()
	return rl
}

// allow returns true if the IP has not exceeded the failure limit.
// It prunes stale entries as a side effect.
func (rl *rateLimiter) allow(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.prune(ip)
	return len(rl.attempts[ip]) < rateLimitMaxFails
}

// record registers a failed attempt for ip.
func (rl *rateLimiter) record(ip string) {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	rl.attempts[ip] = append(rl.attempts[ip], time.Now())
}

func (rl *rateLimiter) prune(ip string) {
	cutoff := time.Now().Add(-rateLimitWindow)
	ts := rl.attempts[ip]
	j := 0
	for _, t := range ts {
		if t.After(cutoff) {
			ts[j] = t
			j++
		}
	}
	if j == 0 {
		delete(rl.attempts, ip)
	} else {
		rl.attempts[ip] = ts[:j]
	}
}

func (rl *rateLimiter) cleanupLoop() {
	ticker := time.NewTicker(rateLimitCleanup)
	for range ticker.C {
		rl.mu.Lock()
		for ip := range rl.attempts {
			rl.prune(ip)
		}
		rl.mu.Unlock()
	}
}
