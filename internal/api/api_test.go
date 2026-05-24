package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/api"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/testutil"
)

// ---------------------------------------------------------------------------
// Test server helper
// ---------------------------------------------------------------------------

func newTestServer(t *testing.T) (*httptest.Server, *db.DB, []byte) {
	t.Helper()
	store := testutil.OpenTestDB(t)
	key := testutil.TestJWTKey(t)
	hub := api.NewHub()
	mgr := newFakeWAManager()
	trk := &fakeTracker{}
	srv := api.NewServer(api.Config{
		JWTKey:   key,
		DataDir:  t.TempDir(),
		MediaDir: t.TempDir(),
	}, store, mgr, trk, hub)
	ts := httptest.NewServer(srv)
	t.Cleanup(ts.Close)
	return ts, store, key
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

func doRequest(t *testing.T, ts *httptest.Server, method, path string, body any, token string) *http.Response {
	t.Helper()
	var buf *bytes.Buffer
	if body != nil {
		b, err := json.Marshal(body)
		require.NoError(t, err)
		buf = bytes.NewBuffer(b)
	} else {
		buf = &bytes.Buffer{}
	}
	req, err := http.NewRequest(method, ts.URL+path, buf)
	require.NoError(t, err)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	require.NoError(t, err)
	return resp
}

func decodeJSON(t *testing.T, resp *http.Response, dst any) {
	t.Helper()
	defer resp.Body.Close()
	require.NoError(t, json.NewDecoder(resp.Body).Decode(dst))
}

// registerAdmin registers the first user and returns the JWT.
func registerAdmin(t *testing.T, ts *httptest.Server, username, password string) string {
	t.Helper()
	resp := doRequest(t, ts, http.MethodPost, "/api/setup/register", map[string]string{
		"username": username,
		"password": password,
	}, "")
	require.Equal(t, http.StatusCreated, resp.StatusCode)
	var out struct {
		Token string `json:"token"`
	}
	decodeJSON(t, resp, &out)
	require.NotEmpty(t, out.Token)
	return out.Token
}

// ---------------------------------------------------------------------------
// Auth / Setup tests
// ---------------------------------------------------------------------------

func TestSetupStatus_NoUsers(t *testing.T) {
	ts, _, _ := newTestServer(t)

	resp := doRequest(t, ts, http.MethodGet, "/api/setup/status", nil, "")
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]bool
	decodeJSON(t, resp, &out)
	assert.False(t, out["hasUsers"])
}

func TestSetupStatus_HasUsers(t *testing.T) {
	ts, store, _ := newTestServer(t)

	require.NoError(t, store.UpsertUser(context.Background(), "admin", "$2a$10$dummy"))

	resp := doRequest(t, ts, http.MethodGet, "/api/setup/status", nil, "")
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]bool
	decodeJSON(t, resp, &out)
	assert.True(t, out["hasUsers"])
}

func TestRegister_FirstUser(t *testing.T) {
	ts, _, _ := newTestServer(t)

	resp := doRequest(t, ts, http.MethodPost, "/api/setup/register", map[string]string{
		"username": "admin",
		"password": "secret123",
	}, "")
	assert.Equal(t, http.StatusCreated, resp.StatusCode)

	var out map[string]string
	decodeJSON(t, resp, &out)
	assert.NotEmpty(t, out["token"])
}

func TestRegister_SecondCallForbidden(t *testing.T) {
	ts, _, _ := newTestServer(t)

	// First registration succeeds.
	registerAdmin(t, ts, "admin", "secret123")

	// Second call should be rejected — registration is closed.
	resp := doRequest(t, ts, http.MethodPost, "/api/setup/register", map[string]string{
		"username": "admin2",
		"password": "secret456",
	}, "")
	assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	resp.Body.Close()
}

func TestRegister_WeakPassword(t *testing.T) {
	ts, _, _ := newTestServer(t)

	resp := doRequest(t, ts, http.MethodPost, "/api/setup/register", map[string]string{
		"username": "admin",
		"password": "short",
	}, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()
}

func TestRegister_MissingFields(t *testing.T) {
	ts, _, _ := newTestServer(t)

	resp := doRequest(t, ts, http.MethodPost, "/api/setup/register", map[string]string{
		"username": "",
		"password": "",
	}, "")
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()
}

func TestLogin_Success(t *testing.T) {
	ts, _, _ := newTestServer(t)
	registerAdmin(t, ts, "admin", "secret123")

	resp := doRequest(t, ts, http.MethodPost, "/api/login", map[string]string{
		"username": "admin",
		"password": "secret123",
	}, "")
	assert.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]string
	decodeJSON(t, resp, &out)
	assert.NotEmpty(t, out["token"])
}

func TestLogin_WrongPassword(t *testing.T) {
	ts, _, _ := newTestServer(t)
	registerAdmin(t, ts, "admin", "secret123")

	resp := doRequest(t, ts, http.MethodPost, "/api/login", map[string]string{
		"username": "admin",
		"password": "wrongpassword",
	}, "")
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	resp.Body.Close()
}

func TestLogin_UnknownUser(t *testing.T) {
	ts, _, _ := newTestServer(t)
	registerAdmin(t, ts, "admin", "secret123")

	resp := doRequest(t, ts, http.MethodPost, "/api/login", map[string]string{
		"username": "ghost",
		"password": "secret123",
	}, "")
	// Must not leak user existence — always 401.
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	resp.Body.Close()
}

func TestAuth_RequiresBearer(t *testing.T) {
	ts, _, _ := newTestServer(t)

	resp := doRequest(t, ts, http.MethodGet, "/api/accounts", nil, "")
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	resp.Body.Close()
}

func TestAuth_ValidToken(t *testing.T) {
	ts, _, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	resp := doRequest(t, ts, http.MethodGet, "/api/accounts", nil, token)
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()
}

func TestAuth_InvalidToken(t *testing.T) {
	ts, _, _ := newTestServer(t)

	resp := doRequest(t, ts, http.MethodGet, "/api/accounts", nil, "not-a-valid-jwt")
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	resp.Body.Close()
}

func TestAuth_SetupRoutesDoNotRequireToken(t *testing.T) {
	ts, _, _ := newTestServer(t)

	resp := doRequest(t, ts, http.MethodGet, "/api/setup/status", nil, "")
	assert.Equal(t, http.StatusOK, resp.StatusCode)
	resp.Body.Close()
}

func TestAuth_LoginRouteDoesNotRequireToken(t *testing.T) {
	ts, _, _ := newTestServer(t)

	// /api/login with wrong credentials should return 401 from the handler itself.
	resp := doRequest(t, ts, http.MethodPost, "/api/login", map[string]string{
		"username": "nobody",
		"password": "12345678",
	}, "")
	assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
	resp.Body.Close()
}

// ---------------------------------------------------------------------------
// Account tests
// ---------------------------------------------------------------------------

func TestAccounts_List_Empty(t *testing.T) {
	ts, _, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	resp := doRequest(t, ts, http.MethodGet, "/api/accounts", nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out []map[string]any
	decodeJSON(t, resp, &out)
	assert.Len(t, out, 0)
}

func TestAccounts_List_WithAccount(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	resp := doRequest(t, ts, http.MethodGet, "/api/accounts", nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out []map[string]any
	decodeJSON(t, resp, &out)
	require.Len(t, out, 1)
	assert.Equal(t, float64(acc.ID), out[0]["id"])
	// fakeWAManager has no client for this id, so connected must be false.
	assert.Equal(t, false, out[0]["connected"])
}

func TestAccounts_PatchLabel(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)
	newLabel := "My Label"

	resp := doRequest(t, ts, http.MethodPatch, fmt.Sprintf("/api/accounts/%d", acc.ID), map[string]string{
		"label": newLabel,
	}, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out db.Account
	decodeJSON(t, resp, &out)
	assert.Equal(t, newLabel, out.Label)
}

func TestAccounts_PatchTrackingActive(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	resp := doRequest(t, ts, http.MethodPatch, fmt.Sprintf("/api/accounts/%d", acc.ID), map[string]any{
		"trackingActive": false,
	}, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out db.Account
	decodeJSON(t, resp, &out)
	assert.Equal(t, false, out.TrackingActive)
}

func TestAccounts_Delete(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	resp := doRequest(t, ts, http.MethodDelete, fmt.Sprintf("/api/accounts/%d", acc.ID), nil, token)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()

	// Verify it's gone from the list.
	listResp := doRequest(t, ts, http.MethodGet, "/api/accounts", nil, token)
	require.Equal(t, http.StatusOK, listResp.StatusCode)
	var out []map[string]any
	decodeJSON(t, listResp, &out)
	assert.Len(t, out, 0)
}

func TestAccounts_RequiresAuth(t *testing.T) {
	ts, _, _ := newTestServer(t)

	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/accounts"},
		{http.MethodPatch, "/api/accounts/1"},
		{http.MethodDelete, "/api/accounts/1"},
	} {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			resp := doRequest(t, ts, tc.method, tc.path, nil, "")
			assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
			resp.Body.Close()
		})
	}
}

// ---------------------------------------------------------------------------
// Contact tests
// ---------------------------------------------------------------------------

func TestContacts_List_Empty(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	resp := doRequest(t, ts, http.MethodGet, fmt.Sprintf("/api/accounts/%d/contacts", acc.ID), nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]any
	decodeJSON(t, resp, &out)
	assert.Equal(t, float64(0), out["total"])
	contacts, ok := out["contacts"].([]any)
	assert.True(t, ok)
	assert.Len(t, contacts, 0)
}

func TestContacts_List_Paginated(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	for i := range 3 {
		jid := fmt.Sprintf("contact%d@s.whatsapp.net", i)
		testutil.SeedContact(t, store, acc.ID, jid)
	}

	resp := doRequest(t, ts, http.MethodGet,
		fmt.Sprintf("/api/accounts/%d/contacts?page=1&limit=2", acc.ID), nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]any
	decodeJSON(t, resp, &out)
	assert.Equal(t, float64(3), out["total"])
	contacts, ok := out["contacts"].([]any)
	assert.True(t, ok)
	assert.Len(t, contacts, 2)
	assert.Equal(t, float64(1), out["page"])
	assert.Equal(t, float64(2), out["limit"])
}

func TestContacts_List_PageTwo(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	for i := range 3 {
		jid := fmt.Sprintf("contact%d@s.whatsapp.net", i)
		testutil.SeedContact(t, store, acc.ID, jid)
	}

	resp := doRequest(t, ts, http.MethodGet,
		fmt.Sprintf("/api/accounts/%d/contacts?page=2&limit=2", acc.ID), nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]any
	decodeJSON(t, resp, &out)
	contacts, ok := out["contacts"].([]any)
	assert.True(t, ok)
	assert.Len(t, contacts, 1) // only 1 left on page 2
}

func TestContacts_Create(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	resp := doRequest(t, ts, http.MethodPost, fmt.Sprintf("/api/accounts/%d/contacts", acc.ID), map[string]string{
		"phone":       "+14155551234",
		"displayName": "Alice",
	}, token)
	require.Equal(t, http.StatusCreated, resp.StatusCode)

	var out db.Contact
	decodeJSON(t, resp, &out)
	assert.Equal(t, "Alice", out.DisplayName)
	assert.NotZero(t, out.ID)
	assert.True(t, out.TrackingEnabled)
}

func TestContacts_Create_MissingPhone(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	resp := doRequest(t, ts, http.MethodPost, fmt.Sprintf("/api/accounts/%d/contacts", acc.ID), map[string]string{
		"phone":       "",
		"displayName": "NoPhone",
	}, token)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()
}

func TestContacts_Create_InvalidPhone(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	resp := doRequest(t, ts, http.MethodPost, fmt.Sprintf("/api/accounts/%d/contacts", acc.ID), map[string]string{
		"phone":       "not-a-phone",
		"displayName": "Bad",
	}, token)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()
}

func TestContacts_Patch_DisplayName(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")
	newName := "Updated Name"

	resp := doRequest(t, ts, http.MethodPatch,
		fmt.Sprintf("/api/accounts/%d/contacts/%d", acc.ID, contact.ID),
		map[string]string{"displayName": newName}, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out db.Contact
	decodeJSON(t, resp, &out)
	assert.Equal(t, newName, out.DisplayName)
}

func TestContacts_Patch_TrackingEnabled(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	resp := doRequest(t, ts, http.MethodPatch,
		fmt.Sprintf("/api/accounts/%d/contacts/%d", acc.ID, contact.ID),
		map[string]any{"trackingEnabled": false}, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out db.Contact
	decodeJSON(t, resp, &out)
	assert.False(t, out.TrackingEnabled)
}

func TestContacts_Delete(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)
	contact := testutil.SeedContact(t, store, acc.ID, "")

	resp := doRequest(t, ts, http.MethodDelete,
		fmt.Sprintf("/api/accounts/%d/contacts/%d", acc.ID, contact.ID), nil, token)
	assert.Equal(t, http.StatusNoContent, resp.StatusCode)
	resp.Body.Close()

	// Verify count is now 0.
	listResp := doRequest(t, ts, http.MethodGet,
		fmt.Sprintf("/api/accounts/%d/contacts", acc.ID), nil, token)
	require.Equal(t, http.StatusOK, listResp.StatusCode)
	var out map[string]any
	decodeJSON(t, listResp, &out)
	assert.Equal(t, float64(0), out["total"])
}

func TestContacts_Search(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	for i, name := range []string{"Alice Smith", "Bob Jones", "Alice Wonderland"} {
		_, err := store.InsertContact(context.Background(), acc.ID,
			fmt.Sprintf("contact%d@s.whatsapp.net", i), "0000000000", name)
		require.NoError(t, err)
	}

	resp := doRequest(t, ts, http.MethodGet,
		fmt.Sprintf("/api/accounts/%d/contacts?q=alice", acc.ID), nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]any
	decodeJSON(t, resp, &out)
	assert.Equal(t, float64(2), out["total"])
}

func TestContacts_RequiresAuth(t *testing.T) {
	ts, _, _ := newTestServer(t)

	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/accounts/1/contacts"},
		{http.MethodPost, "/api/accounts/1/contacts"},
		{http.MethodPatch, "/api/accounts/1/contacts/1"},
		{http.MethodDelete, "/api/accounts/1/contacts/1"},
	} {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			resp := doRequest(t, ts, tc.method, tc.path, nil, "")
			assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
			resp.Body.Close()
		})
	}
}

// ---------------------------------------------------------------------------
// Schedule tests
// ---------------------------------------------------------------------------

func TestSchedule_GetDefault(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	resp := doRequest(t, ts, http.MethodGet, fmt.Sprintf("/api/accounts/%d/schedule", acc.ID), nil, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]any
	decodeJSON(t, resp, &out)
	assert.Equal(t, false, out["forceOffline"])
	slots, ok := out["slots"].([]any)
	assert.True(t, ok)
	assert.Empty(t, slots)
}

func TestSchedule_PutValid(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	body := map[string]any{
		"forceOffline": true,
		"slots": []map[string]any{
			{"startMin": 480, "endMin": 1020},
		},
	}

	resp := doRequest(t, ts, http.MethodPut, fmt.Sprintf("/api/accounts/%d/schedule", acc.ID), body, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]any
	decodeJSON(t, resp, &out)
	assert.Equal(t, true, out["forceOffline"])
	slots, ok := out["slots"].([]any)
	assert.True(t, ok)
	assert.Len(t, slots, 1)
}

func TestSchedule_PutInvalidSlot_StartMinTooHigh(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	body := map[string]any{
		"forceOffline": false,
		"slots": []map[string]any{
			{"startMin": 1440, "endMin": 100}, // 1440 > 1439 — invalid
		},
	}

	resp := doRequest(t, ts, http.MethodPut, fmt.Sprintf("/api/accounts/%d/schedule", acc.ID), body, token)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()
}

func TestSchedule_PutInvalidSlot_EndMinNegative(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	body := map[string]any{
		"forceOffline": false,
		"slots": []map[string]any{
			{"startMin": 100, "endMin": -1},
		},
	}

	resp := doRequest(t, ts, http.MethodPut, fmt.Sprintf("/api/accounts/%d/schedule", acc.ID), body, token)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()
}

func TestSchedule_PutEmptySlots(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	body := map[string]any{
		"forceOffline": false,
		"slots":        []any{},
	}

	resp := doRequest(t, ts, http.MethodPut, fmt.Sprintf("/api/accounts/%d/schedule", acc.ID), body, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]any
	decodeJSON(t, resp, &out)
	slots, ok := out["slots"].([]any)
	assert.True(t, ok)
	assert.Empty(t, slots)
}

func TestSchedule_PutThenGet(t *testing.T) {
	ts, store, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	acc := testutil.SeedAccount(t, store)

	putBody := map[string]any{
		"forceOffline": true,
		"slots": []map[string]any{
			{"startMin": 0, "endMin": 600},
			{"startMin": 720, "endMin": 1439},
		},
	}
	putResp := doRequest(t, ts, http.MethodPut, fmt.Sprintf("/api/accounts/%d/schedule", acc.ID), putBody, token)
	require.Equal(t, http.StatusOK, putResp.StatusCode)
	putResp.Body.Close()

	getResp := doRequest(t, ts, http.MethodGet, fmt.Sprintf("/api/accounts/%d/schedule", acc.ID), nil, token)
	require.Equal(t, http.StatusOK, getResp.StatusCode)

	var out map[string]any
	decodeJSON(t, getResp, &out)
	assert.Equal(t, true, out["forceOffline"])
	slots, ok := out["slots"].([]any)
	assert.True(t, ok)
	assert.Len(t, slots, 2)
}

func TestSchedule_RequiresAuth(t *testing.T) {
	ts, _, _ := newTestServer(t)

	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/api/accounts/1/schedule"},
		{http.MethodPut, "/api/accounts/1/schedule"},
	} {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			resp := doRequest(t, ts, tc.method, tc.path, nil, "")
			assert.Equal(t, http.StatusUnauthorized, resp.StatusCode)
			resp.Body.Close()
		})
	}
}

// ---------------------------------------------------------------------------
// Pair phone / QR tests
// ---------------------------------------------------------------------------

func TestPairPhone_Success(t *testing.T) {
	ts, _, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	resp := doRequest(t, ts, http.MethodPost, "/api/accounts/pair/phone", map[string]string{
		"phone": "+14155551234",
	}, token)
	require.Equal(t, http.StatusOK, resp.StatusCode)

	var out map[string]string
	decodeJSON(t, resp, &out)
	assert.NotEmpty(t, out["code"])
}

func TestPairPhone_MissingPhone(t *testing.T) {
	ts, _, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	resp := doRequest(t, ts, http.MethodPost, "/api/accounts/pair/phone", map[string]string{
		"phone": "",
	}, token)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	resp.Body.Close()
}

func TestPairQR_Returns202(t *testing.T) {
	ts, _, key := newTestServer(t)
	token := testutil.TestJWT(t, key, "admin")

	resp := doRequest(t, ts, http.MethodPost, "/api/accounts/pair/qr", nil, token)
	require.Equal(t, http.StatusAccepted, resp.StatusCode)

	var out map[string]any
	decodeJSON(t, resp, &out)
	assert.Equal(t, true, out["started"])
}
