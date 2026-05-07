package config

import (
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"
)

const LevelAudit slog.Level = slog.LevelError + 1

type Config struct {
	DataDir            string
	ListenAddr         string
	PollInterval       time.Duration
	Bearer             string
	Dev                bool
	WALogLevel         string
	EnableLogs         bool
	EnableTerminalLogs bool
}

func Load() (Config, error) {
	defaultDataDir, err := defaultDataDir()
	if err != nil {
		return Config{}, err
	}

	dataDir := flag.String("data", envOr("WT_DATA_DIR", defaultDataDir), "directory for SQLite databases")
	listen := flag.String("listen", envOr("WT_LISTEN", ":8080"), "HTTP listen address")
	poll := flag.Duration("poll", envDuration("WT_POLL_INTERVAL", 1*time.Minute), "polling interval for picture/about")
	bearer := flag.String("bearer", os.Getenv("WT_BEARER"), "optional bearer token for /api access")
	dev := flag.Bool("dev", envBool("WT_DEV", false), "enable dev CORS for Vite proxy")
	waLog := flag.String("walog", envOr("WT_WA_LOG", "INFO"), "whatsmeow log level (DEBUG|INFO|WARN|ERROR)")
	enableLogs := flag.Bool("enable-logs", envBool("WT_ENABLE_LOGS", false), "enable logging to file")
	enableTerminalLogs := flag.Bool("enable-terminal-logs", envBool("WT_ENABLE_TERMINAL_LOGS", false), "enable logging to terminal and file")

	flag.Parse()

	if *poll < 5*time.Second {
		return Config{}, fmt.Errorf("poll interval too aggressive (%s); minimum 5s", *poll)
	}

	return Config{
		DataDir:            *dataDir,
		ListenAddr:         *listen,
		PollInterval:       *poll,
		Bearer:             *bearer,
		Dev:                *dev,
		WALogLevel:         *waLog,
		EnableLogs:         *enableLogs,
		EnableTerminalLogs: *enableTerminalLogs,
	}, nil
}

func (c Config) TrackerDBPath() string   { return filepath.Join(c.DataDir, "tracker.db") }
func (c Config) WhatsmeowDBPath() string { return filepath.Join(c.DataDir, "whatsmeow.db") }

func defaultDataDir() (string, error) {
	if v := os.Getenv("XDG_DATA_HOME"); v != "" {
		return filepath.Join(v, "whatsapp-tracker"), nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".local", "share", "whatsapp-tracker"), nil
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envBool(key string, def bool) bool {
	v := os.Getenv(key)
	switch v {
	case "1", "true", "TRUE", "yes":
		return true
	case "0", "false", "FALSE", "no":
		return false
	default:
		return def
	}
}

func envDuration(key string, def time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		return def
	}
	return d
}
