package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/api"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/config"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/tracker"
	"github.com/ibrahimalshekh/whatsapp-tracker/internal/wa"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	if err := os.MkdirAll(cfg.DataDir, 0o755); err != nil {
		log.Fatalf("data dir: %v", err)
	}

	ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer cancel()

	store, err := db.Open(ctx, cfg.TrackerDBPath())
	if err != nil {
		log.Fatalf("open tracker db: %v", err)
	}
	defer store.Close()

	hub := api.NewHub()

	waClient, err := wa.New(ctx, wa.Options{
		DBPath:   cfg.WhatsmeowDBPath(),
		LogLevel: cfg.WALogLevel,
	})
	if err != nil {
		log.Fatalf("whatsmeow init: %v", err)
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
			log.Printf("auto-connect: %v", err)
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
		log.Printf("listening on %s (data=%s)", cfg.ListenAddr, cfg.DataDir)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("http: %v", err)
		}
	}()

	<-ctx.Done()
	log.Printf("shutting down")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()
	_ = httpSrv.Shutdown(shutdownCtx)
	trk.Stop()
	waClient.Close()
}
