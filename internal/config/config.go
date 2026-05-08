package config

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/crypto"
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

	// Derived from WT_APP_KEY:
	AppKey []byte // raw 32-byte master key
	JWTKey []byte // derived key for JWT signing
	DBKey  []byte // derived key for DB field encryption
}

// Load resolves the data directory, ensures the .env file exists, loads it,
// parses CLI flags, then derives cryptographic keys.
func Load() (Config, error) {
	// Step 1: Determine data dir from env only (needed before flag.Parse so we can find .env).
	defaultDataDir, err := defaultDataDir()
	if err != nil {
		return Config{}, err
	}
	dataDir := envOr("WT_DATA_DIR", defaultDataDir)

	// Step 2: Ensure .env exists (creates with fresh app key on first run), then load it.
	created, err := ensureAndLoadEnvFile(dataDir)
	if err != nil {
		return Config{}, err
	}
	if created {
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "╔══════════════════════════════════════════════════════╗")
		fmt.Fprintln(os.Stderr, "║              APP KEY GENERATED                       ║")
		fmt.Fprintln(os.Stderr, "╠══════════════════════════════════════════════════════╣")
		fmt.Fprintf(os.Stderr, "║  Location: %s/.env\n", dataDir)
		fmt.Fprintln(os.Stderr, "║                                                      ║")
		fmt.Fprintln(os.Stderr, "║  CRITICAL: Back up this file.                        ║")
		fmt.Fprintln(os.Stderr, "║  Losing it means encrypted data cannot be recovered. ║")
		fmt.Fprintln(os.Stderr, "╚══════════════════════════════════════════════════════╝")
		fmt.Fprintln(os.Stderr, "")
	}

	// Step 3: Parse flags (env vars already set from .env above).
	listen := flag.String("listen", envOr("WT_LISTEN", ":8080"), "HTTP listen address")
	poll := flag.Duration("poll", envDuration("WT_POLL_INTERVAL", 1*time.Minute), "polling interval for picture/about")
	bearer := flag.String("bearer", os.Getenv("WT_BEARER"), "optional static bearer token for /api access")
	dev := flag.Bool("dev", envBool("WT_DEV", false), "enable dev CORS for Vite proxy")
	waLog := flag.String("walog", envOr("WT_WA_LOG", "INFO"), "whatsmeow log level (DEBUG|INFO|WARN|ERROR)")
	enableLogs := flag.Bool("enable-logs", envBool("WT_ENABLE_LOGS", false), "enable logging to file")
	enableTerminalLogs := flag.Bool("enable-terminal-logs", envBool("WT_ENABLE_TERMINAL_LOGS", false), "enable logging to terminal and file")
	dataDirFlag := flag.String("data", dataDir, "directory for SQLite databases")

	flag.Parse()

	if *poll < 5*time.Second {
		return Config{}, fmt.Errorf("poll interval too aggressive (%s); minimum 5s", *poll)
	}

	// Step 4: Decode and validate the app key.
	appKeyHex := os.Getenv("WT_APP_KEY")
	if appKeyHex == "" {
		return Config{}, errors.New("WT_APP_KEY is not set; check your .env file in " + dataDir)
	}
	appKey, err := hex.DecodeString(appKeyHex)
	if err != nil || len(appKey) != 32 {
		return Config{}, errors.New("WT_APP_KEY must be a 64-character hex string (32 bytes)")
	}

	return Config{
		DataDir:            *dataDirFlag,
		ListenAddr:         *listen,
		PollInterval:       *poll,
		Bearer:             *bearer,
		Dev:                *dev,
		WALogLevel:         *waLog,
		EnableLogs:         *enableLogs,
		EnableTerminalLogs: *enableTerminalLogs,
		AppKey:             appKey,
		JWTKey:             crypto.DeriveKey(appKey, "jwt"),
		DBKey:              crypto.DeriveKey(appKey, "db"),
	}, nil
}

func (c Config) TrackerDBPath() string   { return filepath.Join(c.DataDir, "tracker.db") }
func (c Config) WhatsmeowDBPath() string { return filepath.Join(c.DataDir, "whatsmeow.db") }

// ensureAndLoadEnvFile creates .env with a random app key if it does not exist,
// then loads its KEY=VALUE pairs into the environment (without overriding existing env vars).
// Returns (true, nil) if the file was newly created.
func ensureAndLoadEnvFile(dataDir string) (created bool, err error) {
	path := filepath.Join(dataDir, ".env")

	if _, statErr := os.Stat(path); os.IsNotExist(statErr) {
		// Generate fresh 32-byte app key.
		key := make([]byte, 32)
		if _, err := rand.Read(key); err != nil {
			return false, fmt.Errorf("generate app key: %w", err)
		}
		keyHex := hex.EncodeToString(key)

		if err := os.MkdirAll(dataDir, 0o700); err != nil {
			return false, fmt.Errorf("create data dir: %w", err)
		}

		content := "# WhatsApp Tracker — App Configuration\n" +
			"# CRITICAL: Keep this file secret and backed up.\n" +
			"# The APP_KEY encrypts sensitive database fields.\n" +
			"# Losing it means encrypted data cannot be recovered.\n" +
			"\n" +
			"WT_APP_KEY=" + keyHex + "\n" +
			"\n" +
			"# Server (uncomment to override defaults)\n" +
			"# WT_LISTEN=:8080\n" +
			"# WT_POLL_INTERVAL=1m\n" +
			"# WT_DEV=false\n" +
			"\n" +
			"# Logging\n" +
			"# WT_ENABLE_LOGS=false\n" +
			"# WT_ENABLE_TERMINAL_LOGS=false\n" +
			"\n" +
			"# WhatsApp log level (DEBUG|INFO|WARN|ERROR)\n" +
			"# WT_WA_LOG=INFO\n"

		if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
			return false, fmt.Errorf("write .env: %w", err)
		}
		if err := loadEnvFile(path); err != nil {
			return true, err
		}
		return true, nil
	}

	return false, loadEnvFile(path)
}

// loadEnvFile reads KEY=VALUE lines from path and calls os.Setenv for keys
// that are not already set in the environment.
func loadEnvFile(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open .env: %w", err)
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		idx := strings.IndexByte(line, '=')
		if idx < 0 {
			continue
		}
		key := strings.TrimSpace(line[:idx])
		value := strings.TrimSpace(line[idx+1:])
		if key == "" {
			continue
		}
		// Do not override existing env vars — lets systemd Environment= take precedence.
		if os.Getenv(key) == "" {
			if err := os.Setenv(key, value); err != nil {
				return fmt.Errorf("setenv %s: %w", key, err)
			}
		}
	}
	return scanner.Err()
}

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
