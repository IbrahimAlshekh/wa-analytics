package config

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// clearEnv unsets a key for the duration of the test and restores the original.
func clearEnv(t *testing.T, key string) {
	t.Helper()
	orig, had := os.LookupEnv(key)
	t.Cleanup(func() {
		if had {
			os.Setenv(key, orig)
		} else {
			os.Unsetenv(key)
		}
	})
	os.Unsetenv(key)
}

// ---- envOr ------------------------------------------------------------------

func TestEnvOr(t *testing.T) {
	clearEnv(t, "TEST_ENVOR_KEY")

	assert.Equal(t, "default", envOr("TEST_ENVOR_KEY", "default"), "unset returns default")
	t.Setenv("TEST_ENVOR_KEY", "value")
	assert.Equal(t, "value", envOr("TEST_ENVOR_KEY", "default"), "set returns env value")
}

// ---- envBool ----------------------------------------------------------------

func TestEnvBool(t *testing.T) {
	tests := []struct {
		val  string
		want bool
	}{
		{"1", true}, {"true", true}, {"TRUE", true}, {"yes", true},
		{"0", false}, {"false", false}, {"FALSE", false}, {"no", false},
	}
	for _, tc := range tests {
		clearEnv(t, "TEST_ENVBOOL")
		t.Setenv("TEST_ENVBOOL", tc.val)
		assert.Equal(t, tc.want, envBool("TEST_ENVBOOL", false), "input %q", tc.val)
	}
}

func TestEnvBoolDefault(t *testing.T) {
	clearEnv(t, "TEST_ENVBOOL_DEF")
	assert.True(t, envBool("TEST_ENVBOOL_DEF", true), "unset returns default=true")
	assert.False(t, envBool("TEST_ENVBOOL_DEF", false), "unset returns default=false")
}

func TestEnvBoolInvalidFallsBack(t *testing.T) {
	clearEnv(t, "TEST_ENVBOOL_BAD")
	t.Setenv("TEST_ENVBOOL_BAD", "maybe")
	assert.True(t, envBool("TEST_ENVBOOL_BAD", true), "invalid value returns default")
}

// ---- envDuration ------------------------------------------------------------

func TestEnvDuration(t *testing.T) {
	clearEnv(t, "TEST_DUR")
	assert.Equal(t, time.Minute, envDuration("TEST_DUR", time.Minute), "unset returns default")

	t.Setenv("TEST_DUR", "30s")
	assert.Equal(t, 30*time.Second, envDuration("TEST_DUR", time.Minute))
}

func TestEnvDurationInvalidFallsBack(t *testing.T) {
	clearEnv(t, "TEST_DUR_BAD")
	t.Setenv("TEST_DUR_BAD", "notaduration")
	assert.Equal(t, 5*time.Second, envDuration("TEST_DUR_BAD", 5*time.Second))
}

// ---- defaultDataDir ---------------------------------------------------------

func TestDefaultDataDirXDG(t *testing.T) {
	clearEnv(t, "XDG_DATA_HOME")
	t.Setenv("XDG_DATA_HOME", "/custom/xdg")
	got, err := defaultDataDir()
	require.NoError(t, err)
	assert.Equal(t, "/custom/xdg/whatsapp-tracker", got)
}

// ---- ensureAndLoadEnvFile ---------------------------------------------------

func TestEnsureAndLoadEnvFileCreatesFile(t *testing.T) {
	dir := t.TempDir()
	clearEnv(t, "WT_APP_KEY") // must not be set coming in

	created, err := ensureAndLoadEnvFile(dir)
	require.NoError(t, err)
	assert.True(t, created)

	// File should now exist.
	_, statErr := os.Stat(filepath.Join(dir, ".env"))
	require.NoError(t, statErr)

	// WT_APP_KEY should now be set (64 hex chars = 32 bytes).
	key := os.Getenv("WT_APP_KEY")
	assert.Len(t, key, 64)
}

func TestEnsureAndLoadEnvFileDoesNotOverrideExisting(t *testing.T) {
	dir := t.TempDir()
	// Pre-set WT_APP_KEY so the loader should skip it.
	t.Setenv("WT_APP_KEY", "presetvalue")

	// Write a .env with a different value.
	content := "WT_APP_KEY=envfilevalue\n"
	require.NoError(t, os.WriteFile(filepath.Join(dir, ".env"), []byte(content), 0o600))

	created, err := ensureAndLoadEnvFile(dir)
	require.NoError(t, err)
	assert.False(t, created)

	// Pre-set value must win.
	assert.Equal(t, "presetvalue", os.Getenv("WT_APP_KEY"))
}

func TestEnsureAndLoadEnvFileIdempotent(t *testing.T) {
	dir := t.TempDir()
	clearEnv(t, "WT_APP_KEY")

	created1, err := ensureAndLoadEnvFile(dir)
	require.NoError(t, err)
	assert.True(t, created1)

	key1 := os.Getenv("WT_APP_KEY")

	// Second call: file already exists, should not overwrite.
	created2, err := ensureAndLoadEnvFile(dir)
	require.NoError(t, err)
	assert.False(t, created2)

	// Key unchanged.
	assert.Equal(t, key1, os.Getenv("WT_APP_KEY"))
}

// ---- Config helpers ---------------------------------------------------------

func TestTrackerDBPath(t *testing.T) {
	c := Config{DataDir: "/data"}
	assert.Equal(t, "/data/tracker.db", c.TrackerDBPath())
}

func TestWhatsmeowDBPath(t *testing.T) {
	c := Config{DataDir: "/data"}
	assert.Equal(t, "/data/whatsmeow.db", c.WhatsmeowDBPath())
}
