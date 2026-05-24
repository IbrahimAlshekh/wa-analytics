package crypto

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var testKey = []byte("0123456789abcdef0123456789abcdef") // 32 bytes

func TestEncryptDecryptRoundTrip(t *testing.T) {
	plain := "hello world"
	enc := Encrypt(plain, testKey)
	require.True(t, IsEncrypted(enc), "Encrypt should produce enc: prefix")

	got, err := Decrypt(enc, testKey)
	require.NoError(t, err)
	assert.Equal(t, plain, got)
}

func TestEncryptDeterministic(t *testing.T) {
	// Same input + key must yield same ciphertext (required for WHERE clauses).
	plain := "+1-415-555-1234"
	enc1 := Encrypt(plain, testKey)
	enc2 := Encrypt(plain, testKey)
	assert.Equal(t, enc1, enc2, "Encrypt must be deterministic")
}

func TestEncryptEmptyReturnsEmpty(t *testing.T) {
	assert.Equal(t, "", Encrypt("", testKey))
}

func TestDecryptPlaintextPassthrough(t *testing.T) {
	// Values without enc: prefix are returned as-is (legacy plaintext).
	got, err := Decrypt("legacy-value", testKey)
	require.NoError(t, err)
	assert.Equal(t, "legacy-value", got)
}

func TestDecryptEmptyReturnsEmpty(t *testing.T) {
	got, err := Decrypt("", testKey)
	require.NoError(t, err)
	assert.Equal(t, "", got)
}

func TestDecryptTamperedFails(t *testing.T) {
	enc := Encrypt("secret", testKey)
	// Flip the last character of the base64 payload.
	tampered := enc[:len(enc)-1] + "X"
	if tampered[len(tampered)-1] == enc[len(enc)-1] {
		tampered = enc[:len(enc)-1] + "Y"
	}
	_, err := Decrypt(tampered, testKey)
	assert.Error(t, err)
}

func TestDecryptWrongKeyFails(t *testing.T) {
	enc := Encrypt("secret", testKey)
	wrongKey := []byte("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
	_, err := Decrypt(enc, wrongKey)
	assert.Error(t, err)
}

func TestIsEncrypted(t *testing.T) {
	assert.True(t, IsEncrypted("enc:abc"))
	assert.False(t, IsEncrypted("plaintext"))
	assert.False(t, IsEncrypted(""))
	assert.False(t, IsEncrypted("enc"))
}

func TestDeriveKeyLabelSeparation(t *testing.T) {
	master := []byte("master-key-32bytes-for-testing!!")
	jwt := DeriveKey(master, "jwt")
	db := DeriveKey(master, "db")
	assert.Len(t, jwt, 32)
	assert.Len(t, db, 32)
	assert.NotEqual(t, jwt, db, "different labels must produce different keys")
}

func TestDeriveKeyDeterministic(t *testing.T) {
	master := []byte("master-key-32bytes-for-testing!!")
	k1 := DeriveKey(master, "jwt")
	k2 := DeriveKey(master, "jwt")
	assert.Equal(t, k1, k2)
}

func TestEncryptDifferentKeysProduceDifferentOutput(t *testing.T) {
	plain := "same plaintext"
	key2 := []byte("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF")
	enc1 := Encrypt(plain, testKey)
	enc2 := Encrypt(plain, key2)
	assert.NotEqual(t, enc1, enc2)
	assert.True(t, strings.HasPrefix(enc1, "enc:"))
	assert.True(t, strings.HasPrefix(enc2, "enc:"))
}
