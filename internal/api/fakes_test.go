package api_test

import (
	"context"
	"sync"

	whatsmeow "go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/types"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/api"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

// ---- fakeWAClient -----------------------------------------------------------

type fakeWAClient struct {
	connected   bool
	ownJID      string
	sendErr     error
	uploadErr   error
	allContacts map[types.JID]types.ContactInfo
}

func (f *fakeWAClient) IsConnected() bool { return f.connected }
func (f *fakeWAClient) OwnJID() string    { return f.ownJID }

func (f *fakeWAClient) SendMessage(_ context.Context, _ types.JID, _ *waE2E.Message) (whatsmeow.SendResponse, error) {
	return whatsmeow.SendResponse{}, f.sendErr
}

func (f *fakeWAClient) UploadMedia(_ context.Context, _ []byte, _ whatsmeow.MediaType) (whatsmeow.UploadResponse, error) {
	return whatsmeow.UploadResponse{}, f.uploadErr
}

func (f *fakeWAClient) FetchMessageHistory(_ context.Context, _ *types.MessageInfo) error {
	return nil
}

func (f *fakeWAClient) GetAllContacts(_ context.Context) (map[types.JID]types.ContactInfo, error) {
	return f.allContacts, nil
}

// ---- fakeWAManager ----------------------------------------------------------

type fakeWAManager struct {
	mu        sync.Mutex
	clients   map[int64]*fakeWAClient
	removeErr error
}

func newFakeWAManager() *fakeWAManager {
	return &fakeWAManager{clients: make(map[int64]*fakeWAClient)}
}

func (f *fakeWAManager) GetByAccountID(id int64) api.WAClientForAPI {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, ok := f.clients[id]
	if !ok {
		return nil
	}
	return c
}

func (f *fakeWAManager) IsConnected(id int64) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	c, ok := f.clients[id]
	return ok && c.connected
}

func (f *fakeWAManager) StartQRPairing(_ context.Context) (<-chan string, error) {
	ch := make(chan string)
	close(ch)
	return ch, nil
}

func (f *fakeWAManager) PairPhone(_ context.Context, _ string) (string, error) {
	return "123-456", nil
}

func (f *fakeWAManager) Remove(_ context.Context, _ int64) error {
	return f.removeErr
}

// ---- fakeTracker ------------------------------------------------------------

type fakeTracker struct {
	mu         sync.Mutex
	subscribed []db.Contact
}

func (f *fakeTracker) SubscribeContact(_ context.Context, c db.Contact) {
	f.mu.Lock()
	f.subscribed = append(f.subscribed, c)
	f.mu.Unlock()
}

func (f *fakeTracker) ApplySchedule(_ int64, _ bool, _ []db.ScheduleSlot) {}

func (f *fakeTracker) RefreshContactPicture(_, _ int64) {}

// Compile-time interface checks.
var (
	_ api.WAClientForAPI = (*fakeWAClient)(nil)
	_ api.WAManager      = (*fakeWAManager)(nil)
	_ api.Tracker        = (*fakeTracker)(nil)
)
