package testutil

import (
	"testing"

	"github.com/ibrahimalshekh/whatsapp-tracker/internal/api"
)

// TestJWTKey returns a deterministic 32-byte key suitable for test JWT signing.
func TestJWTKey(_ testing.TB) []byte {
	return []byte("testutil-jwt-key-32bytes-padding!")
}

// TestJWT generates a valid signed JWT for username using key.
func TestJWT(tb testing.TB, key []byte, username string) string {
	tb.Helper()
	token, err := api.GenerateToken(username, key)
	if err != nil {
		tb.Fatalf("testutil: generate jwt: %v", err)
	}
	return token
}
