package db

import (
	"context"
	"database/sql"
	"embed"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/crypto"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

type DB struct {
	*sql.DB
	key []byte // 32-byte key for encrypting sensitive fields
}

// Open opens the SQLite database at path and applies SQL migrations.
// key is the 32-byte encryption key used to encrypt/decrypt sensitive fields on read/write.
// Run cmd/migrate-encryption once after the first deployment with encryption enabled to
// convert any pre-existing plaintext rows — Open itself does not do that migration.
func Open(ctx context.Context, path string, key []byte) (*DB, error) {
	dsn := fmt.Sprintf("file:%s?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000", path)
	sqlDB, err := sql.Open("sqlite3", dsn)
	if err != nil {
		return nil, err
	}
	if err := sqlDB.PingContext(ctx); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	sqlDB.SetMaxOpenConns(1) // SQLite writers
	if err := migrate(ctx, sqlDB); err != nil {
		_ = sqlDB.Close()
		return nil, err
	}
	return &DB{DB: sqlDB, key: key}, nil
}

// enc encrypts s using the DB's key. Already-encrypted values are returned unchanged.
func (db *DB) enc(s string) string {
	if crypto.IsEncrypted(s) {
		return s // already encrypted (e.g. if called twice)
	}
	return crypto.Encrypt(s, db.key)
}

// dec decrypts s using the DB's key. Plaintext values (legacy) are returned unchanged.
func (db *DB) dec(s string) string {
	v, err := crypto.Decrypt(s, db.key)
	if err != nil {
		slog.Warn("db: decrypt failed", "err", err)
		return s
	}
	return v
}

func migrate(ctx context.Context, db *sql.DB) error {
	// Ensure migration tracking table exists.
	if _, err := db.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)`); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	// Get already-applied migrations.
	rows, err := db.QueryContext(ctx, `SELECT name FROM schema_migrations`)
	if err != nil {
		return fmt.Errorf("query schema_migrations: %w", err)
	}
	applied := map[string]bool{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return err
		}
		applied[name] = true
	}
	rows.Close()

	// Collect and sort migration files.
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		if applied[name] {
			continue
		}
		body, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		// Run statements individually so a duplicate-column error on ALTER TABLE
		// (which can happen when migrating an existing DB) doesn't abort the whole file.
		for _, stmt := range splitStatements(string(body)) {
			if _, err := db.ExecContext(ctx, stmt); err != nil {
				if isIgnorableAlterError(err) {
					slog.Debug("db: migration statement already applied, skipping", "name", name, "err", err)
					continue
				}
				return fmt.Errorf("migration %s: %w", name, err)
			}
		}
		if _, err := db.ExecContext(ctx,
			`INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`,
			name, time.Now().Unix(),
		); err != nil {
			return fmt.Errorf("record migration %s: %w", name, err)
		}
		slog.Info("db: applied migration", "name", name)
	}
	return nil
}

// splitStatements splits a SQL string on semicolons into individual statements.
func splitStatements(sql string) []string {
	var stmts []string
	var cur strings.Builder
	for _, line := range strings.Split(sql, "\n") {
		cur.WriteString(line)
		cur.WriteByte('\n')
		if strings.HasSuffix(strings.TrimSpace(line), ";") {
			if s := strings.TrimSpace(cur.String()); s != "" && s != ";" {
				stmts = append(stmts, s)
			}
			cur.Reset()
		}
	}
	if s := strings.TrimSpace(cur.String()); s != "" {
		stmts = append(stmts, s)
	}
	return stmts
}

// isIgnorableAlterError returns true for SQLite errors that occur when trying
// to add a column that already exists.
func isIgnorableAlterError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "duplicate column name") ||
		strings.Contains(msg, "already has a column named")
}
