// Package testutil provides shared helpers for tests across the whatsapp-tracker project.
package testutil

import (
	"context"
	"crypto/rand"
	"path/filepath"
	"testing"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/db"
)

// OpenTestDB opens a temporary SQLite database with a random encryption key,
// applies all migrations, and registers a cleanup to close the DB when the test ends.
// Each call gets its own isolated directory from tb.TempDir().
func OpenTestDB(tb testing.TB) *db.DB {
	tb.Helper()

	// Random 32-byte encryption key — unique per test.
	key := make([]byte, 32)
	if _, err := rand.Read(key); err != nil {
		tb.Fatalf("testutil: generate db key: %v", err)
	}

	path := filepath.Join(tb.TempDir(), "test.db")
	store, err := db.Open(context.Background(), path, key)
	if err != nil {
		tb.Fatalf("testutil: open test db: %v", err)
	}
	tb.Cleanup(func() { _ = store.Close() })
	return store
}
