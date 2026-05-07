package main

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

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

func main() {
	// Early stderr-only logger until we have the data dir.
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})))

	cfg, err := config.Load()
	if err != nil {
		slog.Error("load config", "err", err)
		os.Exit(1)
	}
	if err := os.MkdirAll(cfg.DataDir, 0o755); err != nil {
		slog.Error("create data dir", "path", cfg.DataDir, "err", err)
		os.Exit(1)
	}

	// Set up file logging — append to tracker.log in the data dir.
	logPath := filepath.Join(cfg.DataDir, "tracker.log")
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		slog.Error("open log file", "path", logPath, "err", err)
		os.Exit(1)
	}
	defer logFile.Close()

	w := io.MultiWriter(os.Stderr, logFile)
	slog.SetDefault(slog.New(slog.NewTextHandler(w, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})))
	slog.Info("logging to file", "path", logPath)

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	store, err := db.Open(ctx, cfg.TrackerDBPath())
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

	// Wire up the OnPaired callback: when a new account finishes QR/phone pairing,
	// insert it in DB, register with the manager, then start tracking.
	manager.OnPaired = func(client *wa.Client) {
		jid := client.OwnJID()
		slog.Info("main: new account paired", "jid", jid)
		acc, err := store.InsertAccount(ctx, jid, "")
		if err != nil {
			slog.Error("main: insert account failed", "jid", jid, "err", err)
			return
		}
		manager.RegisterPaired(acc.ID)
		startTracker(ctx, trackerMgr, client, store, hub, acc.ID, cfg.PollInterval)
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
		startTracker(ctx, trackerMgr, client, store, hub, acc.ID, cfg.PollInterval)
	}

	manager.ConnectAll(ctx)

	srv := api.NewServer(api.Config{
		Bearer: cfg.Bearer,
		Dev:    cfg.Dev,
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

func startTracker(ctx context.Context, mgr *tracker.TrackerManager, client *wa.Client, store *db.DB, hub *api.Hub, accountID int64, interval time.Duration) {
	trk := mgr.Add(accountID, tracker.Deps{
		WA:       client,
		DB:       store,
		Hub:      hub,
		Interval: interval,
	})
	client.AttachHandler(trk.HandleEvent)
	slog.Info("main: tracker started", "accountID", accountID)
}
