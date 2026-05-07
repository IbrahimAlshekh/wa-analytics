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

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/api"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/config"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/tracker"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/wa"
)

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

	// Write to both stderr and the log file.
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

	waClient, err := wa.New(ctx, wa.Options{
		DBPath:   cfg.WhatsmeowDBPath(),
		LogLevel: cfg.WALogLevel,
	})
	if err != nil {
		slog.Error("whatsmeow init", "err", err)
		os.Exit(1)
	}

	trk := tracker.New(tracker.Deps{
		WA:       waClient,
		DB:       store,
		Hub:      hub,
		Interval: cfg.PollInterval,
	})
	waClient.AttachHandler(trk.HandleEvent)

	if waClient.IsLoggedIn() {
		if err := waClient.Connect(ctx); err != nil {
			slog.Warn("auto-connect failed", "err", err)
		}
	}

	srv := api.NewServer(api.Config{
		Bearer: cfg.Bearer,
		Dev:    cfg.Dev,
	}, store, waClient, trk, hub)

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
	trk.Stop()
	waClient.Close()
}
