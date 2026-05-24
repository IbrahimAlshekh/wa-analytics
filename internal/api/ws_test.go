package api_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/api"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/testutil"
)

// wsDialer connects to a test server's /api/ws endpoint.
var wsDialer = websocket.Dialer{HandshakeTimeout: time.Second}

// connectWS dials the WS endpoint and returns the connection.
// Caller is responsible for closing.
func connectWS(t *testing.T, ts *httptest.Server) *websocket.Conn {
	t.Helper()
	u := "ws" + strings.TrimPrefix(ts.URL, "http") + "/api/ws"
	conn, _, err := wsDialer.Dial(u, http.Header{"Origin": []string{ts.URL}})
	require.NoError(t, err, "ws dial")
	return conn
}

// sendAuth sends the auth frame. If token is empty it sends an empty JSON object.
func sendAuth(t *testing.T, conn *websocket.Conn, token string) {
	t.Helper()
	var msg []byte
	if token == "" {
		msg = []byte(`{}`)
	} else {
		m, _ := json.Marshal(map[string]string{"token": token})
		msg = m
	}
	require.NoError(t, conn.WriteMessage(websocket.TextMessage, msg))
}

// newWSTestServer creates a minimal test server with WS support.
func newWSTestServer(t *testing.T) (*httptest.Server, []byte) {
	t.Helper()
	store := testutil.OpenTestDB(t)
	key := testutil.TestJWTKey(t)
	hub := api.NewHub()
	srv := api.NewServer(api.Config{
		JWTKey:  key,
		Dev:     true,
		DataDir: t.TempDir(),
	}, store, newFakeWAManager(), &fakeTracker{}, hub)
	ts := httptest.NewServer(srv)
	t.Cleanup(ts.Close)
	return ts, key
}

// TestWS_ValidTokenReceivesBroadcast connects with a valid JWT and asserts a
// broadcast reaches the client within 1 second.
func TestWS_ValidTokenReceivesBroadcast(t *testing.T) {
	restore := api.SetWSAuthTimeout(200 * time.Millisecond)
	defer restore()
	rp := api.SetWSPingPeriod(60 * time.Second) // keep ping out of the way
	defer rp()

	_, key := newWSTestServer(t)
	hub := api.NewHub()
	// Re-build a fresh server with this hub so we can broadcast to the WS client.
	store := testutil.OpenTestDB(t)
	srv := api.NewServer(api.Config{JWTKey: key, Dev: true, DataDir: t.TempDir()},
		store, newFakeWAManager(), &fakeTracker{}, hub)
	ts2 := httptest.NewServer(srv)
	defer ts2.Close()

	conn := connectWS(t, ts2)
	defer conn.Close()

	token := testutil.TestJWT(t, key, "user")
	sendAuth(t, conn, token)

	// Give the server a moment to register the client.
	time.Sleep(50 * time.Millisecond)

	hub.Broadcast("ping", map[string]any{"hello": "world"})

	conn.SetReadDeadline(time.Now().Add(time.Second)) //nolint:errcheck
	_, raw, err := conn.ReadMessage()
	require.NoError(t, err)

	var got map[string]any
	require.NoError(t, json.Unmarshal(raw, &got))
	assert.Equal(t, "ping", got["type"])
	assert.Equal(t, "world", got["hello"])
}

// TestWS_InvalidTokenCloses verifies close code 4001 on bad JWT.
func TestWS_InvalidTokenCloses(t *testing.T) {
	restore := api.SetWSAuthTimeout(200 * time.Millisecond)
	defer restore()

	ts, _ := newWSTestServer(t)
	conn := connectWS(t, ts)
	defer conn.Close()

	sendAuth(t, conn, "not-a-valid-jwt")

	conn.SetReadDeadline(time.Now().Add(time.Second)) //nolint:errcheck
	_, _, err := conn.ReadMessage()
	require.Error(t, err)
	var closeErr *websocket.CloseError
	require.ErrorAs(t, err, &closeErr)
	assert.Equal(t, 4001, closeErr.Code)
}

// TestWS_MissingTokenCloses verifies close code 4001 when no token field.
func TestWS_MissingTokenCloses(t *testing.T) {
	restore := api.SetWSAuthTimeout(200 * time.Millisecond)
	defer restore()

	ts, _ := newWSTestServer(t)
	conn := connectWS(t, ts)
	defer conn.Close()

	sendAuth(t, conn, "") // sends `{}` — no token field

	conn.SetReadDeadline(time.Now().Add(time.Second)) //nolint:errcheck
	_, _, err := conn.ReadMessage()
	require.Error(t, err)
	var closeErr *websocket.CloseError
	require.ErrorAs(t, err, &closeErr)
	assert.Equal(t, 4001, closeErr.Code)
}

// TestWS_AuthTimeoutCloses verifies the connection is closed when no auth
// message arrives within the auth window.
func TestWS_AuthTimeoutCloses(t *testing.T) {
	restore := api.SetWSAuthTimeout(80 * time.Millisecond)
	defer restore()

	ts, _ := newWSTestServer(t)
	conn := connectWS(t, ts)
	defer conn.Close()

	// Do NOT send any auth message — server should close the connection after timeout.
	conn.SetReadDeadline(time.Now().Add(500 * time.Millisecond)) //nolint:errcheck
	_, _, err := conn.ReadMessage()
	assert.Error(t, err, "connection should be closed after auth timeout")
}

// TestWS_BroadcastNilPayload verifies Broadcast with nil payload produces a
// message with only the "type" field.
func TestWS_BroadcastNilPayload(t *testing.T) {
	restore := api.SetWSPingPeriod(60 * time.Second)
	defer restore()
	ra := api.SetWSAuthTimeout(200 * time.Millisecond)
	defer ra()

	store := testutil.OpenTestDB(t)
	key := testutil.TestJWTKey(t)
	hub := api.NewHub()
	srv := api.NewServer(api.Config{JWTKey: key, Dev: true, DataDir: t.TempDir()},
		store, newFakeWAManager(), &fakeTracker{}, hub)
	ts := httptest.NewServer(srv)
	defer ts.Close()

	conn := connectWS(t, ts)
	defer conn.Close()

	sendAuth(t, conn, testutil.TestJWT(t, key, "user"))
	time.Sleep(50 * time.Millisecond)

	hub.Broadcast("heartbeat", nil)

	conn.SetReadDeadline(time.Now().Add(time.Second)) //nolint:errcheck
	_, raw, err := conn.ReadMessage()
	require.NoError(t, err)

	var got map[string]any
	require.NoError(t, json.Unmarshal(raw, &got))
	assert.Equal(t, "heartbeat", got["type"])
	assert.Len(t, got, 1, "nil payload must not add extra keys")
}

// TestWS_BroadcastMapPayload verifies map[string]any fields are flattened into
// the envelope alongside "type".
func TestWS_BroadcastMapPayload(t *testing.T) {
	restore := api.SetWSPingPeriod(60 * time.Second)
	defer restore()
	ra := api.SetWSAuthTimeout(200 * time.Millisecond)
	defer ra()

	store := testutil.OpenTestDB(t)
	key := testutil.TestJWTKey(t)
	hub := api.NewHub()
	srv := api.NewServer(api.Config{JWTKey: key, Dev: true, DataDir: t.TempDir()},
		store, newFakeWAManager(), &fakeTracker{}, hub)
	ts := httptest.NewServer(srv)
	defer ts.Close()

	conn := connectWS(t, ts)
	defer conn.Close()

	sendAuth(t, conn, testutil.TestJWT(t, key, "user"))
	time.Sleep(50 * time.Millisecond)

	hub.Broadcast("presence", map[string]any{"contactId": float64(42), "state": "available"})

	conn.SetReadDeadline(time.Now().Add(time.Second)) //nolint:errcheck
	_, raw, err := conn.ReadMessage()
	require.NoError(t, err)

	var got map[string]any
	require.NoError(t, json.Unmarshal(raw, &got))
	assert.Equal(t, "presence", got["type"])
	assert.Equal(t, float64(42), got["contactId"])
	assert.Equal(t, "available", got["state"])
}

// TestWS_NonMapPayloadNestedUnderData verifies that non-map payloads are
// nested under a "data" key.
func TestWS_NonMapPayloadNestedUnderData(t *testing.T) {
	restore := api.SetWSPingPeriod(60 * time.Second)
	defer restore()
	ra := api.SetWSAuthTimeout(200 * time.Millisecond)
	defer ra()

	store := testutil.OpenTestDB(t)
	key := testutil.TestJWTKey(t)
	hub := api.NewHub()
	srv := api.NewServer(api.Config{JWTKey: key, Dev: true, DataDir: t.TempDir()},
		store, newFakeWAManager(), &fakeTracker{}, hub)
	ts := httptest.NewServer(srv)
	defer ts.Close()

	conn := connectWS(t, ts)
	defer conn.Close()

	sendAuth(t, conn, testutil.TestJWT(t, key, "user"))
	time.Sleep(50 * time.Millisecond)

	hub.Broadcast("custom", "hello world")

	conn.SetReadDeadline(time.Now().Add(time.Second)) //nolint:errcheck
	_, raw, err := conn.ReadMessage()
	require.NoError(t, err)

	var got map[string]any
	require.NoError(t, json.Unmarshal(raw, &got))
	assert.Equal(t, "custom", got["type"])
	assert.Equal(t, "hello world", got["data"])
}

// TestWS_SlowClientSurvives verifies that flooding a client's send buffer
// does not crash the server or disconnect the client — backpressure just drops
// messages and the connection stays alive.
func TestWS_SlowClientSurvives(t *testing.T) {
	restoreBuffer := api.SetWSClientBuffer(1)
	defer restoreBuffer()
	restorePing := api.SetWSPingPeriod(60 * time.Second)
	defer restorePing()
	restoreAuth := api.SetWSAuthTimeout(200 * time.Millisecond)
	defer restoreAuth()

	store := testutil.OpenTestDB(t)
	key := testutil.TestJWTKey(t)
	hub := api.NewHub()
	srv := api.NewServer(api.Config{JWTKey: key, Dev: true, DataDir: t.TempDir()},
		store, newFakeWAManager(), &fakeTracker{}, hub)
	ts := httptest.NewServer(srv)
	defer ts.Close()

	conn := connectWS(t, ts)
	defer conn.Close()

	sendAuth(t, conn, testutil.TestJWT(t, key, "user"))
	time.Sleep(50 * time.Millisecond)

	// Rapidly flood the buffer — the server must not panic.
	const floods = 50
	for i := range floods {
		hub.Broadcast("flood", map[string]any{"i": i})
	}

	// Drain whatever arrived within a short window.
	conn.SetReadDeadline(time.Now().Add(200 * time.Millisecond)) //nolint:errcheck
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}

	// The connection must still be alive — send a ping.
	conn.SetReadDeadline(time.Time{}) //nolint:errcheck
	err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(time.Second))
	assert.NoError(t, err, "connection should remain alive after buffer flood")
}

