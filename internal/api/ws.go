package api

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	wsWriteTimeout = 10 * time.Second
	wsPingPeriod   = 30 * time.Second
	wsClientBuffer = 64
	wsAuthTimeout  = 10 * time.Second
)

type Hub struct {
	mu      sync.RWMutex
	clients map[*wsClient]struct{}
}

func NewHub() *Hub {
	return &Hub{clients: map[*wsClient]struct{}{}}
}

func (h *Hub) add(c *wsClient) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	count := len(h.clients)
	h.mu.Unlock()
	slog.Info("ws: client connected", "remote", c.conn.RemoteAddr(), "total_clients", count)
}

func (h *Hub) remove(c *wsClient) {
	h.mu.Lock()
	delete(h.clients, c)
	count := len(h.clients)
	h.mu.Unlock()
	close(c.send)
	slog.Info("ws: client disconnected", "remote", c.conn.RemoteAddr(), "total_clients", count)
}

// Broadcast sends an envelope `{type: kind, ...payload}` to every connected client.
func (h *Hub) Broadcast(kind string, payload any) {
	envelope := map[string]any{"type": kind}
	switch p := payload.(type) {
	case map[string]any:
		for k, v := range p {
			envelope[k] = v
		}
	case nil:
		// nothing
	default:
		envelope["data"] = payload
	}
	body, err := json.Marshal(envelope)
	if err != nil {
		slog.Error("ws: broadcast marshal failed", "kind", kind, "err", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	dropped := 0
	for c := range h.clients {
		select {
		case c.send <- body:
		default:
			dropped++
		}
	}
	if dropped > 0 {
		slog.Warn("ws: broadcast dropped slow clients", "kind", kind, "dropped", dropped)
	} else {
		slog.Debug("ws: broadcast sent", "kind", kind, "clients", len(h.clients))
	}
}

type wsClient struct {
	conn *websocket.Conn
	send chan []byte
}

var defaultUpgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	upgrader := defaultUpgrader
	upgrader.CheckOrigin = func(req *http.Request) bool {
		origin := req.Header.Get("Origin")
		if s.cfg.Dev {
			return true
		}
		// Reject empty origin in production — prevents requests from non-browser scripts
		// that omit the header, and simplifies the security model.
		if origin == "" {
			return false
		}
		u, err := url.Parse(origin)
		if err != nil {
			return false
		}
		return u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Host == req.Host
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Warn("ws: upgrade failed", "remote", r.RemoteAddr, "err", err)
		return
	}

	// Auth handshake: the client must send {"token":"<jwt>"} as the very first message.
	conn.SetReadDeadline(time.Now().Add(wsAuthTimeout)) //nolint:errcheck
	_, raw, err := conn.ReadMessage()
	if err != nil {
		slog.Warn("ws: auth read failed", "remote", conn.RemoteAddr(), "err", err)
		conn.Close()
		return
	}
	var authMsg struct {
		Token string `json:"token"`
	}
	if json.Unmarshal(raw, &authMsg) != nil || authMsg.Token == "" {
		_ = conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(4001, "auth required"))
		conn.Close()
		return
	}
	if _, err := ValidateToken(authMsg.Token, s.cfg.JWTKey); err != nil {
		slog.Warn("ws: invalid token", "remote", conn.RemoteAddr())
		_ = conn.WriteMessage(websocket.CloseMessage,
			websocket.FormatCloseMessage(4001, "invalid token"))
		conn.Close()
		return
	}
	conn.SetReadDeadline(time.Time{}) //nolint:errcheck — clear deadline after auth

	c := &wsClient{conn: conn, send: make(chan []byte, wsClientBuffer)}
	s.hub.add(c)

	go c.writePump(s.hub)
	c.readPump(s.hub)
}

func (c *wsClient) writePump(h *Hub) {
	pingTick := time.NewTicker(wsPingPeriod)
	defer func() {
		pingTick.Stop()
		_ = c.conn.Close()
	}()
	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				slog.Debug("ws: write failed", "remote", c.conn.RemoteAddr(), "err", err)
				return
			}
		case <-pingTick.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				slog.Debug("ws: ping failed", "remote", c.conn.RemoteAddr(), "err", err)
				return
			}
		}
	}
}

func (c *wsClient) readPump(h *Hub) {
	defer h.remove(c)
	c.conn.SetReadLimit(1024)
	_ = c.conn.SetReadDeadline(time.Now().Add(2 * wsPingPeriod))
	c.conn.SetPongHandler(func(string) error {
		_ = c.conn.SetReadDeadline(time.Now().Add(2 * wsPingPeriod))
		return nil
	})
	for {
		// We don't expect client→server messages after auth; just block until close.
		if _, _, err := c.conn.ReadMessage(); err != nil {
			return
		}
	}
}
