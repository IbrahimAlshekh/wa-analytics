package tracker_test

import (
	"context"
	"sync"

	"go.mau.fi/whatsmeow/types"
)

// fakeWAClient is a minimal WAClient for tests.
type fakeWAClient struct {
	mu        sync.Mutex
	connected bool
	calls     []string // method names in call order

	subscribeErr   error
	getUserInfoRet map[types.JID]types.UserInfo
	getUserInfoErr error
	getPicRet      *types.ProfilePictureInfo
	getPicErr      error
	getLIDRet      types.JID
	getLIDErr      error
}

func (f *fakeWAClient) record(name string) {
	f.mu.Lock()
	f.calls = append(f.calls, name)
	f.mu.Unlock()
}

func (f *fakeWAClient) Calls() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	out := make([]string, len(f.calls))
	copy(out, f.calls)
	return out
}

func (f *fakeWAClient) IsConnected() bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.connected
}

func (f *fakeWAClient) OwnJID() string { return "test@s.whatsapp.net" }

func (f *fakeWAClient) Connect(_ context.Context) error {
	f.record("Connect")
	f.mu.Lock()
	f.connected = true
	f.mu.Unlock()
	return nil
}

func (f *fakeWAClient) SoftDisconnect() {
	f.record("SoftDisconnect")
	f.mu.Lock()
	f.connected = false
	f.mu.Unlock()
}

func (f *fakeWAClient) SendAvailable(_ context.Context) error {
	f.record("SendAvailable")
	return nil
}

func (f *fakeWAClient) SubscribePresence(_ context.Context, _ types.JID) error {
	f.record("SubscribePresence")
	return f.subscribeErr
}

func (f *fakeWAClient) GetLIDForJID(_ context.Context, _ types.JID) (types.JID, error) {
	f.record("GetLIDForJID")
	return f.getLIDRet, f.getLIDErr
}

func (f *fakeWAClient) DownloadMedia(_ context.Context, _ any) ([]byte, error) {
	f.record("DownloadMedia")
	return nil, nil
}

func (f *fakeWAClient) GetProfilePicture(_ context.Context, _ types.JID) (*types.ProfilePictureInfo, error) {
	f.record("GetProfilePicture")
	return f.getPicRet, f.getPicErr
}

func (f *fakeWAClient) GetUserInfo(_ context.Context, _ []types.JID) (map[types.JID]types.UserInfo, error) {
	f.record("GetUserInfo")
	return f.getUserInfoRet, f.getUserInfoErr
}
