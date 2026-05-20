package wa

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/proto/waE2E"
	"go.mau.fi/whatsmeow/store"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	waLog "go.mau.fi/whatsmeow/util/log"
)

type Options struct {
	DBPath   string
	LogLevel string
}

type Client struct {
	device *store.Device
	cli    *whatsmeow.Client
	log    waLog.Logger

	mu          sync.Mutex
	handler     func(any)
	qrFlowAlive bool
	qrCancel    context.CancelFunc
}

// NewFromDevice creates a Client from an existing whatsmeow device.
func NewFromDevice(_ context.Context, device *store.Device, logLevel string) (*Client, error) {
	level := strings.ToUpper(logLevel)
	if level == "" {
		level = "INFO"
	}
	log := waLog.Stdout("WA", level, true)
	c := &Client{device: device, log: log}
	c.cli = whatsmeow.NewClient(device, log)
	c.cli.AddEventHandler(c.dispatch)
	return c, nil
}

// New is a convenience constructor for single-account use.
// It opens its own sqlstore container and picks the first device.
func New(ctx context.Context, opts Options) (*Client, error) {
	level := strings.ToUpper(opts.LogLevel)
	if level == "" {
		level = "INFO"
	}
	dbLog := waLog.Stdout("WA-DB", "WARN", true)
	dsn := fmt.Sprintf("file:%s?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000", opts.DBPath)
	container, err := sqlstore.New(ctx, "sqlite3", dsn, dbLog)
	if err != nil {
		return nil, fmt.Errorf("sqlstore: %w", err)
	}
	device, err := container.GetFirstDevice(ctx)
	if err != nil {
		return nil, fmt.Errorf("get device: %w", err)
	}
	return NewFromDevice(ctx, device, opts.LogLevel)
}

func (c *Client) dispatch(evt any) {
	c.mu.Lock()
	h := c.handler
	c.mu.Unlock()
	if h != nil {
		h(evt)
	}
}

func (c *Client) AttachHandler(h func(any)) {
	c.mu.Lock()
	c.handler = h
	c.mu.Unlock()
}

func (c *Client) IsLoggedIn() bool  { return c.device != nil && c.device.ID != nil }
func (c *Client) IsConnected() bool { return c.cli != nil && c.cli.IsConnected() }

func (c *Client) OwnJID() string {
	if !c.IsLoggedIn() {
		return ""
	}
	return c.device.ID.String()
}

// DeviceJID returns the device JID used to look up this client in the manager.
func (c *Client) DeviceJID() *store.Device { return c.device }

func (c *Client) Connect(ctx context.Context) error {
	if c.cli.IsConnected() {
		return nil
	}
	return c.cli.Connect()
}

func (c *Client) StartQRFlow(ctx context.Context) (<-chan string, error) {
	c.mu.Lock()
	if c.IsLoggedIn() {
		c.mu.Unlock()
		return nil, errors.New("already linked")
	}
	if c.qrFlowAlive {
		c.mu.Unlock()
		return nil, errors.New("QR flow already in progress")
	}
	if c.cli.IsConnected() {
		c.cli.Disconnect()
	}
	flowCtx, cancel := context.WithCancel(context.Background())
	qrCh, err := c.cli.GetQRChannel(flowCtx)
	if err != nil {
		cancel()
		c.mu.Unlock()
		return nil, fmt.Errorf("qr channel: %w", err)
	}
	if err := c.cli.Connect(); err != nil {
		cancel()
		c.mu.Unlock()
		return nil, fmt.Errorf("connect: %w", err)
	}
	out := make(chan string, 4)
	c.qrFlowAlive = true
	c.qrCancel = cancel
	c.mu.Unlock()

	go func() {
		defer close(out)
		defer func() {
			c.mu.Lock()
			c.qrFlowAlive = false
			c.qrCancel = nil
			c.mu.Unlock()
		}()
		for {
			select {
			case <-ctx.Done():
				cancel()
				return
			case item, ok := <-qrCh:
				if !ok {
					return
				}
				switch item.Event {
				case "code":
					select {
					case out <- item.Code:
					case <-time.After(2 * time.Second):
					}
				default:
					return
				}
			}
		}
	}()
	return out, nil
}

func (c *Client) PairPhone(ctx context.Context, phone string) (string, error) {
	c.mu.Lock()
	if c.IsLoggedIn() {
		c.mu.Unlock()
		return "", errors.New("already linked")
	}
	if c.qrFlowAlive {
		c.mu.Unlock()
		return "", errors.New("another auth flow in progress")
	}
	c.mu.Unlock()
	if !c.cli.IsConnected() {
		if err := c.cli.Connect(); err != nil {
			return "", fmt.Errorf("connect: %w", err)
		}
	}
	return c.cli.PairPhone(ctx, normalizePhone(phone), true, whatsmeow.PairClientChrome, "WhatsApp Tracker")
}

func (c *Client) Logout(ctx context.Context) error {
	if !c.IsLoggedIn() {
		c.cli.Disconnect()
		return nil
	}
	return c.cli.Logout(ctx)
}

func (c *Client) Close() {
	c.mu.Lock()
	if c.qrCancel != nil {
		c.qrCancel()
	}
	c.mu.Unlock()
	if c.cli != nil {
		c.cli.Disconnect()
	}
}

func (c *Client) SubscribePresence(ctx context.Context, jid types.JID) error {
	return c.cli.SubscribePresence(ctx, jid)
}

func (c *Client) DownloadMedia(ctx context.Context, msg any) ([]byte, error) {
	downloader, ok := msg.(whatsmeow.DownloadableMessage)
	if !ok {
		return nil, errors.New("message is not downloadable")
	}
	return c.cli.Download(ctx, downloader)
}

func (c *Client) SendAvailable(ctx context.Context) error {
	return c.cli.SendPresence(ctx, types.PresenceAvailable)
}

func (c *Client) SendMessage(ctx context.Context, to types.JID, msg *waE2E.Message) (whatsmeow.SendResponse, error) {
	return c.cli.SendMessage(ctx, to, msg)
}

func (c *Client) UploadMedia(ctx context.Context, data []byte, appMessageType whatsmeow.MediaType) (whatsmeow.UploadResponse, error) {
	return c.cli.Upload(ctx, data, appMessageType)
}

func (c *Client) GetProfilePicture(ctx context.Context, jid types.JID) (*types.ProfilePictureInfo, error) {
	return c.cli.GetProfilePictureInfo(ctx, jid, &whatsmeow.GetProfilePictureParams{Preview: false})
}

func (c *Client) GetUserInfo(ctx context.Context, jids []types.JID) (map[types.JID]types.UserInfo, error) {
	return c.cli.GetUserInfo(ctx, jids)
}

// GetLIDForJID returns the LID (anonymous identifier) WhatsApp uses for the given JID.
func (c *Client) GetLIDForJID(ctx context.Context, jid types.JID) (types.JID, error) {
	info, err := c.cli.GetUserInfo(ctx, []types.JID{jid})
	if err != nil {
		return types.JID{}, err
	}
	u, ok := info[jid]
	if !ok {
		return types.JID{}, nil
	}
	return u.LID, nil
}

// GetAllContacts returns all contacts from the local whatsmeow contact store.
func (c *Client) GetAllContacts(ctx context.Context) (map[types.JID]types.ContactInfo, error) {
	return c.device.Contacts.GetAllContacts(ctx)
}

// JIDFromPhone converts +1-415-555-1234 → 14155551234@s.whatsapp.net
func JIDFromPhone(phone string) (types.JID, error) {
	digits := normalizePhone(phone)
	if digits == "" {
		return types.JID{}, errors.New("invalid phone")
	}
	return types.NewJID(digits, types.DefaultUserServer), nil
}

func normalizePhone(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
