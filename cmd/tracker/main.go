package main

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
	"google.golang.org/protobuf/proto"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/api"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/config"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/tracker"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/wa"
	waStore "go.mau.fi/whatsmeow/store"
)

func init() {
	// Override the default "whatsmeow" device name that WhatsApp shows in the
	// linked-devices list. Must be set before any Client is created.
	waStore.DeviceProps.Os = proto.String("Whatsapp web")
}

type AuditHandler struct {
	slog.Handler
}

func (h *AuditHandler) Enabled(ctx context.Context, level slog.Level) bool {
	if level >= config.LevelAudit {
		return true
	}
	return h.Handler.Enabled(ctx, level)
}

func main() {
	cfg, err := config.Load()
	if err != nil {
		slog.Error("load config", "err", err)
		os.Exit(1)
	}

	// Handle subcommands before starting the server.
	if len(os.Args) > 1 {
		switch os.Args[1] {
		case "user":
			handleUserCommand(cfg)
			return
		}
	}

	var logWriter io.Writer = io.Discard
	baseLevel := slog.LevelError + 10 // Practically disabled
	if cfg.EnableTerminalLogs || cfg.EnableLogs {
		if err := os.MkdirAll(cfg.DataDir, 0o755); err != nil {
			fmt.Fprintf(os.Stderr, "create data dir failed: %v\n", err)
			os.Exit(1)
		}
		logPath := filepath.Join(cfg.DataDir, "tracker.log")
		logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
		if err != nil {
			fmt.Fprintf(os.Stderr, "open log file failed: %v\n", err)
			os.Exit(1)
		}
		defer logFile.Close()

		if cfg.EnableTerminalLogs {
			logWriter = io.MultiWriter(os.Stderr, logFile)
		} else {
			logWriter = logFile
		}
		baseLevel = slog.LevelDebug
	} else {
		// If logs are disabled, still allow Audit logs to stderr
		logWriter = os.Stderr
	}

	h := &AuditHandler{
		Handler: slog.NewTextHandler(logWriter, &slog.HandlerOptions{
			Level: baseLevel,
		}),
	}
	slog.SetDefault(slog.New(h))

	if cfg.EnableLogs || cfg.EnableTerminalLogs {
		slog.Info("logging initialized", "terminal", cfg.EnableTerminalLogs)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	store, err := db.Open(ctx, cfg.TrackerDBPath(), cfg.DBKey)
	if err != nil {
		slog.Error("open tracker db", "path", cfg.TrackerDBPath(), "err", err)
		os.Exit(1)
	}
	defer store.Close()

	hub := api.NewHub()

	manager, err := wa.NewClientManager(ctx, cfg.WhatsmeowDBPath(), cfg.WALogLevel)
	if err != nil {
		slog.Error("whatsmeow init", "err", err)
		os.Exit(1)
	}
	defer manager.Close()

	trackerMgr := tracker.NewTrackerManager()
	mediaDir := filepath.Join(cfg.DataDir, "media")
	if err := os.MkdirAll(mediaDir, 0o755); err != nil {
		slog.Error("create media dir failed", "err", err)
		os.Exit(1)
	}

	// Wire up the OnPaired callback: when a new account finishes QR/phone pairing,
	// insert it in DB, register with the manager, then start tracking.
	manager.OnPaired = func(client *wa.Client) {
		jid := client.OwnJID()
		slog.Log(context.Background(), config.LevelAudit, "main: new account paired", "jid", jid)
		acc, err := store.InsertAccount(ctx, jid, "")
		if err != nil {
			slog.Log(context.Background(), config.LevelAudit, "main: insert account failed", "jid", jid, "err", err)
			return
		}
		manager.RegisterPaired(acc.ID)
		startTracker(ctx, trackerMgr, client, store, hub, acc.ID, cfg.PollInterval, mediaDir)
		go func() {
			n, err := api.SyncWAContacts(ctx, client, store, acc.ID)
			if err != nil {
				slog.Warn("main: contact sync failed after pairing", "accountID", acc.ID, "err", err)
				return
			}
			slog.Info("main: synced contacts after pairing", "accountID", acc.ID, "count", n)
		}()
	}

	// Load all already-paired accounts from the whatsmeow store.
	accounts, err := store.ListAccounts(ctx)
	if err != nil {
		slog.Error("main: list accounts failed", "err", err)
		os.Exit(1)
	}

	if len(accounts) == 0 {
		// Check if whatsmeow has a device that was paired before the multi-account migration.
		// If so, create a default account record and backfill contacts.
		devices, err := manager.Container().GetAllDevices(ctx)
		if err == nil && len(devices) > 0 {
			d := devices[0]
			jidStr := d.ID.String()
			acc, err := store.InsertAccount(ctx, jidStr, "Default")
			if err != nil {
				slog.Error("main: backfill insert account failed", "jid", jidStr, "err", err)
			} else {
				if err := store.BackfillAccountID(ctx, acc.ID); err != nil {
					slog.Error("main: backfill contacts failed", "accountID", acc.ID, "err", err)
				} else {
					slog.Info("main: backfilled legacy contacts", "accountID", acc.ID)
				}
				accounts = []db.Account{acc}
			}
		}
	}

	// Register each account with the manager and start its tracker.
	for _, acc := range accounts {
		client, err := manager.Register(ctx, acc.ID, acc.JID)
		if err != nil {
			slog.Warn("main: register account failed", "accountID", acc.ID, "jid", acc.JID, "err", err)
			continue
		}
		startTracker(ctx, trackerMgr, client, store, hub, acc.ID, cfg.PollInterval, mediaDir)
		accID := acc.ID
		go func() {
			n, err := api.SyncWAContacts(ctx, client, store, accID)
			if err != nil {
				slog.Warn("main: contact sync failed on startup", "accountID", accID, "err", err)
				return
			}
			slog.Info("main: synced contacts on startup", "accountID", accID, "count", n)
		}()
	}

	manager.ConnectAll(ctx)

	srv := api.NewServer(api.Config{
		Bearer:   cfg.Bearer,
		Dev:      cfg.Dev,
		JWTKey:   cfg.JWTKey,
		MediaDir: mediaDir,
	}, store, manager, trackerMgr, hub)

	httpSrv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           srv,
		ReadHeaderTimeout: 10 * time.Second,
	}

	go func() {
		slog.Info("server listening", "addr", cfg.ListenAddr, "data", cfg.DataDir)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("http server", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = httpSrv.Shutdown(shutdownCtx)
	trackerMgr.StopAll()
}

func startTracker(ctx context.Context, mgr *tracker.TrackerManager, client *wa.Client, store *db.DB, hub *api.Hub, accountID int64, interval time.Duration, mediaDir string) {
	trk := mgr.Add(accountID, tracker.Deps{
		WA:       client,
		DB:       store,
		Hub:      hub,
		Interval: interval,
		MediaDir: mediaDir,
	})
	client.AttachHandler(trk.HandleEvent)
	slog.Info("main: tracker started", "accountID", accountID)
}

func handleUserCommand(cfg config.Config) {
	if len(os.Args) < 3 {
		fmt.Println("Usage: tracker user <add|delete|list> [args]")
		os.Exit(1)
	}

	ctx := context.Background()
	store, err := db.Open(ctx, cfg.TrackerDBPath(), cfg.DBKey)
	if err != nil {
		fmt.Printf("Failed to open database: %v\n", err)
		os.Exit(1)
	}
	defer store.Close()

	switch os.Args[2] {
	case "add":
		if len(os.Args) < 4 {
			fmt.Println("Usage: tracker user add <username> [password]")
			os.Exit(1)
		}
		username := os.Args[3]
		var password string
		if len(os.Args) >= 5 {
			password = os.Args[4]
			fmt.Fprintln(os.Stderr, "Warning: password passed as argument is visible in process list and shell history.")
			fmt.Fprintln(os.Stderr, "Prefer: tracker user add <username>  (prompts securely)")
		} else {
			fmt.Print("Password: ")
			raw, err := term.ReadPassword(int(os.Stdin.Fd()))
			if err != nil {
				fmt.Printf("\nFailed to read password: %v\n", err)
				os.Exit(1)
			}
			fmt.Println()
			if len(raw) == 0 {
				fmt.Println("Password cannot be empty.")
				os.Exit(1)
			}
			password = string(raw)
		}
		hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			fmt.Printf("Failed to hash password: %v\n", err)
			os.Exit(1)
		}
		if err := store.UpsertUser(ctx, username, string(hash)); err != nil {
			fmt.Printf("Failed to save user: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("User %s added/updated successfully.\n", username)

	case "delete":
		if len(os.Args) < 4 {
			fmt.Println("Usage: tracker user delete <username>")
			os.Exit(1)
		}
		username := os.Args[3]
		if err := store.DeleteUser(ctx, username); err != nil {
			fmt.Printf("Failed to delete user: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("User %s deleted successfully.\n", username)

	case "list":
		users, err := store.ListUsers(ctx)
		if err != nil {
			fmt.Printf("Failed to list users: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Users:")
		for _, u := range users {
			fmt.Printf("- %s\n", u)
		}

	default:
		fmt.Printf("Unknown user subcommand: %s\n", os.Args[2])
		os.Exit(1)
	}
}
