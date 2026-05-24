package wa

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---- normalizePhone ---------------------------------------------------------

func TestNormalizePhone(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"+1-415-555-1234", "14155551234"},
		{"(415) 555-1234", "4155551234"},
		{"14155551234", "14155551234"},
		{"+966501234567", "966501234567"},
		{"", ""},
		{"abc", ""},
		{"+", ""},
	}
	for _, tc := range tests {
		assert.Equal(t, tc.want, normalizePhone(tc.input), "input: %q", tc.input)
	}
}

// ---- JIDFromPhone -----------------------------------------------------------

func TestJIDFromPhone_Valid(t *testing.T) {
	jid, err := JIDFromPhone("+14155551234")
	require.NoError(t, err)
	assert.Equal(t, "14155551234", jid.User)
	assert.Equal(t, "s.whatsapp.net", jid.Server)
}

func TestJIDFromPhone_WithFormatting(t *testing.T) {
	jid, err := JIDFromPhone("+1 (415) 555-1234")
	require.NoError(t, err)
	assert.Equal(t, "14155551234", jid.User)
}

func TestJIDFromPhone_EmptyFails(t *testing.T) {
	_, err := JIDFromPhone("")
	assert.Error(t, err)
}

func TestJIDFromPhone_NoPunctuation(t *testing.T) {
	jid, err := JIDFromPhone("14155551234")
	require.NoError(t, err)
	assert.Equal(t, "14155551234", jid.User)
}

func TestJIDFromPhone_JIDString(t *testing.T) {
	jid, err := JIDFromPhone("+966501234567")
	require.NoError(t, err)
	assert.Equal(t, "966501234567@s.whatsapp.net", jid.String())
}
