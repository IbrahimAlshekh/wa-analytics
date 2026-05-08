package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"strings"

	"golang.org/x/crypto/hkdf"
)

const encPrefix = "enc:"

// DeriveKey derives a 32-byte key from a master key using HKDF-SHA256.
// label should be a short unique string identifying the key's purpose (e.g. "jwt", "db").
func DeriveKey(master []byte, label string) []byte {
	r := hkdf.New(sha256.New, master, nil, []byte(label))
	key := make([]byte, 32)
	if _, err := io.ReadFull(r, key); err != nil {
		panic("crypto: key derivation failed: " + err.Error())
	}
	return key
}

// Encrypt encrypts plaintext deterministically with AES-256-GCM.
// The same plaintext + key always produces the same ciphertext, which allows
// encrypted values to be used in WHERE clauses.
// Returns "enc:<base64url(nonce+ciphertext+tag)>" or "" if plaintext is empty.
func Encrypt(plaintext string, key []byte) string {
	if plaintext == "" {
		return ""
	}
	// Deterministic nonce: HMAC-SHA256(key, plaintext), take first 12 bytes.
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(plaintext))
	nonce := mac.Sum(nil)[:12]

	block, err := aes.NewCipher(key)
	if err != nil {
		panic("crypto: AES cipher: " + err.Error())
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		panic("crypto: GCM: " + err.Error())
	}
	// gcm.Seal appends ciphertext+tag to dst; dst=nonce so result is nonce+ciphertext+tag.
	sealed := gcm.Seal(append([]byte(nil), nonce...), nonce, []byte(plaintext), nil)
	return encPrefix + base64.URLEncoding.EncodeToString(sealed)
}

// Decrypt decrypts a value produced by Encrypt.
// If the value does not start with "enc:", it is returned as-is (legacy plaintext).
func Decrypt(value string, key []byte) (string, error) {
	if value == "" {
		return "", nil
	}
	if !strings.HasPrefix(value, encPrefix) {
		return value, nil // legacy plaintext — pass through unchanged
	}
	data, err := base64.URLEncoding.DecodeString(value[len(encPrefix):])
	if err != nil {
		return "", fmt.Errorf("crypto: base64 decode: %w", err)
	}
	if len(data) < 12 {
		return "", errors.New("crypto: ciphertext too short")
	}
	nonce := data[:12]
	ciphertextAndTag := data[12:]

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("crypto: AES cipher: %w", err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("crypto: GCM: %w", err)
	}
	plaintext, err := gcm.Open(nil, nonce, ciphertextAndTag, nil)
	if err != nil {
		return "", fmt.Errorf("crypto: decrypt: %w", err)
	}
	return string(plaintext), nil
}

// IsEncrypted reports whether a value was produced by Encrypt.
func IsEncrypted(s string) bool {
	return strings.HasPrefix(s, encPrefix)
}
