package api

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---- clientIP ---------------------------------------------------------------

func TestClientIP_Normal(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "192.168.1.1:4567"
	assert.Equal(t, "192.168.1.1", clientIP(r))
}

func TestClientIP_IPv6(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "[::1]:9000"
	assert.Equal(t, "::1", clientIP(r))
}

func TestClientIP_NoPort(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	r.RemoteAddr = "192.168.1.1"
	// net.SplitHostPort fails when no port; returns addr as-is.
	assert.Equal(t, "192.168.1.1", clientIP(r))
}

// ---- parseID ----------------------------------------------------------------

func TestParseID_Valid(t *testing.T) {
	mux := http.NewServeMux()
	var capturedID int64
	mux.HandleFunc("GET /accounts/{id}", func(w http.ResponseWriter, r *http.Request) {
		id, err := parseID(r)
		require.NoError(t, err)
		capturedID = id
	})
	req := httptest.NewRequest(http.MethodGet, "/accounts/42", nil)
	mux.ServeHTTP(httptest.NewRecorder(), req)
	assert.Equal(t, int64(42), capturedID)
}

func TestParseID_Missing(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	_, err := parseID(r)
	assert.Error(t, err)
}

func TestParseID_NonNumeric(t *testing.T) {
	mux := http.NewServeMux()
	var parseErr error
	mux.HandleFunc("GET /accounts/{id}", func(w http.ResponseWriter, r *http.Request) {
		_, parseErr = parseID(r)
	})
	req := httptest.NewRequest(http.MethodGet, "/accounts/abc", nil)
	mux.ServeHTTP(httptest.NewRecorder(), req)
	assert.Error(t, parseErr)
}

// ---- parseCID ---------------------------------------------------------------

func TestParseCID_Valid(t *testing.T) {
	mux := http.NewServeMux()
	var capturedCID int64
	mux.HandleFunc("GET /contacts/{cid}", func(w http.ResponseWriter, r *http.Request) {
		cid, err := parseCID(r)
		require.NoError(t, err)
		capturedCID = cid
	})
	req := httptest.NewRequest(http.MethodGet, "/contacts/7", nil)
	mux.ServeHTTP(httptest.NewRecorder(), req)
	assert.Equal(t, int64(7), capturedCID)
}

func TestParseCID_Missing(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/", nil)
	_, err := parseCID(r)
	assert.Error(t, err)
}

// ---- wajid ------------------------------------------------------------------

func TestWajid_ValidPhone(t *testing.T) {
	jid, err := wajid("+14155551234")
	require.NoError(t, err)
	assert.Equal(t, "14155551234@s.whatsapp.net", jid)
}

func TestWajid_StripFormatting(t *testing.T) {
	jid, err := wajid("+1-415-555-1234")
	require.NoError(t, err)
	assert.Equal(t, "14155551234@s.whatsapp.net", jid)
}

func TestWajid_EmptyPhone(t *testing.T) {
	_, err := wajid("")
	assert.Error(t, err)
}

func TestWajid_OnlyPunctuation(t *testing.T) {
	_, err := wajid("+-.()")
	assert.Error(t, err)
}
