package wa

import (
	"context"
	"fmt"
	"log/slog"
	"sync"

	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"

	_ "github.com/mattn/go-sqlite3"
)

type managedAccount struct {
	accountID int64
	device    *store.Device
	client    *Client
}

// ClientManager manages multiple WhatsApp clients (one per paired account).
type ClientManager struct {
	container *sqlstore.Container
	logLevel  string

	mu       sync.RWMutex
	byID     map[int64]*managedAccount  // accountID → account
	byDevJID map[string]*managedAccount // device JID (e.g. 49xxx:27@s.whatsapp.net) → account

	// OnPaired is called (in a goroutine) when a new account finishes pairing.
	// The caller must: insert the account into DB, call RegisterPaired, start tracker.
	OnPaired func(client *Client)

	pendingMu  sync.Mutex
	pendingAcc *managedAccount // at most one pending pairing in flight
}

// NewClientManager opens the whatsmeow sqlstore and returns a manager.
// Devices are not loaded automatically; call Register for each known account.
func NewClientManager(ctx context.Context, dbPath, logLevel string) (*ClientManager, error) {
	if logLevel == "" {
		logLevel = "INFO"
	}
	dbLog := waLog.Stdout("WA-DB", "WARN", true)
	dsn := fmt.Sprintf("file:%s?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000", dbPath)
	container, err := sqlstore.New(ctx, "sqlite3", dsn, dbLog)
	if err != nil {
		return nil, fmt.Errorf("sqlstore: %w", err)
	}
	return &ClientManager{
		container: container,
		logLevel:  logLevel,
		byID:      make(map[int64]*managedAccount),
		byDevJID:  make(map[string]*managedAccount),
	}, nil
}

// Register loads an existing (already persisted) device by its JID and registers it
// under the given accountID. Returns the client so the caller can attach a handler.
func (m *ClientManager) Register(ctx context.Context, accountID int64, devJID string) (*Client, error) {
	jid, err := types.ParseJID(devJID)
	if err != nil {
		return nil, fmt.Errorf("parse jid %q: %w", devJID, err)
	}
	device, err := m.container.GetDevice(ctx, jid)
	if err != nil {
		return nil, fmt.Errorf("get device: %w", err)
	}
	if device == nil {
		return nil, fmt.Errorf("device not found: %s", devJID)
	}
	client, err := NewFromDevice(ctx, device, m.logLevel)
	if err != nil {
		return nil, err
	}
	acc := &managedAccount{accountID: accountID, device: device, client: client}
	m.mu.Lock()
	m.byID[accountID] = acc
	m.byDevJID[devJID] = acc
	m.mu.Unlock()
	return client, nil
}

// RegisterPaired is called after OnPaired finishes inserting the account into DB.
// It moves the pending client into the live maps under the given accountID.
func (m *ClientManager) RegisterPaired(accountID int64) {
	m.pendingMu.Lock()
	acc := m.pendingAcc
	m.pendingAcc = nil
	m.pendingMu.Unlock()

	if acc == nil || acc.client == nil {
		return
	}
	acc.accountID = accountID
	devJID := acc.client.OwnJID()
	m.mu.Lock()
	m.byID[accountID] = acc
	m.byDevJID[devJID] = acc
	m.mu.Unlock()
	slog.Info("wa: account registered", "accountID", accountID, "jid", devJID)
}

// GetByAccountID returns the live client for the given account, or nil.
func (m *ClientManager) GetByAccountID(id int64) *Client {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if acc, ok := m.byID[id]; ok {
		return acc.client
	}
	return nil
}

// IsConnected returns true if the account's client is connected.
func (m *ClientManager) IsConnected(accountID int64) bool {
	c := m.GetByAccountID(accountID)
	return c != nil && c.IsConnected()
}

// ConnectAll connects all logged-in clients.
func (m *ClientManager) ConnectAll(ctx context.Context) {
	m.mu.RLock()
	accs := make([]*managedAccount, 0, len(m.byID))
	for _, acc := range m.byID {
		accs = append(accs, acc)
	}
	m.mu.RUnlock()

	for _, acc := range accs {
		if acc.client.IsLoggedIn() {
			if err := acc.client.Connect(ctx); err != nil {
				slog.Warn("wa: auto-connect failed", "accountID", acc.accountID, "err", err)
			}
		}
	}
}

// newPendingClient creates a fresh device + client for a pairing flow.
// It also wires the "Connected" event to call OnPaired once.
func (m *ClientManager) newPendingClient(ctx context.Context) (*managedAccount, error) {
	device := m.container.NewDevice()
	client, err := NewFromDevice(ctx, device, m.logLevel)
	if err != nil {
		return nil, err
	}
	acc := &managedAccount{device: device, client: client}

	var fired bool
	var firedMu sync.Mutex
	client.AttachHandler(func(evt any) {
		if _, ok := evt.(*events.Connected); ok {
			firedMu.Lock()
			if !fired {
				fired = true
				firedMu.Unlock()
				if jid := client.OwnJID(); jid != "" {
					slog.Info("wa: new account paired via event", "jid", jid)
					if m.OnPaired != nil {
						go m.OnPaired(client)
					}
				}
				return
			}
			firedMu.Unlock()
		}
	})

	return acc, nil
}

// StartQRPairing creates a new device, starts the QR flow, and returns the QR code channel.
func (m *ClientManager) StartQRPairing(ctx context.Context) (<-chan string, error) {
	m.pendingMu.Lock()
	defer m.pendingMu.Unlock()

	if m.pendingAcc != nil {
		return nil, fmt.Errorf("another pairing is already in progress")
	}
	acc, err := m.newPendingClient(ctx)
	if err != nil {
		return nil, err
	}
	m.pendingAcc = acc

	codes, err := acc.client.StartQRFlow(ctx)
	if err != nil {
		m.pendingAcc = nil
		return nil, err
	}
	// Clean up pending slot if the flow ends without pairing.
	go func() {
		for range codes {
		}
		m.pendingMu.Lock()
		if m.pendingAcc == acc && !acc.client.IsLoggedIn() {
			m.pendingAcc = nil
			acc.client.Close()
		}
		m.pendingMu.Unlock()
	}()
	return codes, nil
}

// PairPhone creates a new device, starts phone pairing, and returns the pairing code.
func (m *ClientManager) PairPhone(ctx context.Context, phone string) (string, error) {
	m.pendingMu.Lock()
	if m.pendingAcc != nil {
		m.pendingMu.Unlock()
		return "", fmt.Errorf("another pairing is already in progress")
	}
	acc, err := m.newPendingClient(ctx)
	if err != nil {
		m.pendingMu.Unlock()
		return "", err
	}
	m.pendingAcc = acc
	m.pendingMu.Unlock()

	code, err := acc.client.PairPhone(ctx, phone)
	if err != nil {
		m.pendingMu.Lock()
		if m.pendingAcc == acc {
			m.pendingAcc = nil
		}
		m.pendingMu.Unlock()
		acc.client.Close()
		return "", err
	}
	return code, nil
}

// Remove disconnects a client and deletes its device from the whatsmeow store.
func (m *ClientManager) Remove(ctx context.Context, accountID int64) error {
	m.mu.Lock()
	acc, ok := m.byID[accountID]
	if !ok {
		m.mu.Unlock()
		return fmt.Errorf("account %d not found in manager", accountID)
	}
	delete(m.byID, accountID)
	delete(m.byDevJID, acc.client.OwnJID())
	m.mu.Unlock()

	acc.client.Close()
	if err := m.container.DeleteDevice(ctx, acc.device); err != nil {
		slog.Warn("wa: delete device failed", "accountID", accountID, "err", err)
	}
	return nil
}

// Close disconnects all clients and closes the container.
func (m *ClientManager) Close() {
	m.mu.RLock()
	accs := make([]*managedAccount, 0, len(m.byID))
	for _, acc := range m.byID {
		accs = append(accs, acc)
	}
	m.mu.RUnlock()
	for _, acc := range accs {
		acc.client.Close()
	}
	_ = m.container.Close()
}

// Container returns the underlying whatsmeow sqlstore container.
// Used by main for one-time migration discovery of legacy devices.
func (m *ClientManager) Container() *sqlstore.Container { return m.container }

// AllDeviceJIDs returns a snapshot of all currently registered device JIDs.
func (m *ClientManager) AllDeviceJIDs() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]string, 0, len(m.byDevJID))
	for jid := range m.byDevJID {
		out = append(out, jid)
	}
	return out
}
