package api

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

var jwtTestKey = []byte("test-jwt-key-32bytes-padding!!!!")

func TestGenerateValidateRoundTrip(t *testing.T) {
	token, err := GenerateToken("alice", jwtTestKey)
	require.NoError(t, err)
	assert.NotEmpty(t, token)

	username, err := ValidateToken(token, jwtTestKey)
	require.NoError(t, err)
	assert.Equal(t, "alice", username)
}

func TestValidateToken_WrongKey(t *testing.T) {
	token, err := GenerateToken("alice", jwtTestKey)
	require.NoError(t, err)

	wrongKey := []byte("wrong-key-32bytes-padding!!!!!!!!") // different content
	_, err = ValidateToken(token, wrongKey)
	assert.Error(t, err)
}

func TestValidateToken_Expired(t *testing.T) {
	claims := &Claims{
		Username: "alice",
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(time.Now().Add(-2 * time.Hour)),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-1 * time.Hour)),
		},
	}
	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenStr, err := tok.SignedString(jwtTestKey)
	require.NoError(t, err)

	_, err = ValidateToken(tokenStr, jwtTestKey)
	assert.Error(t, err, "expired token must be rejected")
}

func TestValidateToken_NoneAlgAttack(t *testing.T) {
	// A token with alg=none is rejected because our key function asserts *jwt.SigningMethodHMAC.
	// {"alg":"none","typ":"JWT"}.{"username":"admin","exp":9999999999}.
	unsignedToken := "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0" +
		".eyJ1c2VybmFtZSI6ImFkbWluIiwiZXhwIjo5OTk5OTk5OTk5fQ" +
		"."
	_, err := ValidateToken(unsignedToken, jwtTestKey)
	assert.Error(t, err, "none-alg token must be rejected")
}

func TestValidateToken_MalformedToken(t *testing.T) {
	_, err := ValidateToken("not-a-token", jwtTestKey)
	assert.Error(t, err)
}

func TestValidateToken_EmptyToken(t *testing.T) {
	_, err := ValidateToken("", jwtTestKey)
	assert.Error(t, err)
}
