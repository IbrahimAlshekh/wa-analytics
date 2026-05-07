package api

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	wsWriteTimeout = 10 * time.Second
	wsPingPeriod   = 30 * time.Second
	wsClientBuffer = 64
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
	h.mu.Unlock()
}

func (h *Hub) remove(c *wsClient) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
	close(c.send)
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
		log.Printf("hub: marshal: %v", err)
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.clients {
		select {
		case c.send <- body:
		default:
			// drop slow clients silently — the next tick will pick them up
		}
	}
}

type wsClient struct {
	conn *websocket.Conn
	send chan []byte
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 4096,
	CheckOrigin:     func(r *http.Request) bool { return true }, // local tool
}

func (s *Server) handleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws: upgrade: %v", err)
		return
	}
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
				return
			}
		case <-pingTick.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(wsWriteTimeout))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
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
		// We don't expect client→server messages; just block until close.
		if _, _, err := c.conn.ReadMessage(); err != nil {
			return
		}
	}
}
