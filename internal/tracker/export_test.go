package tracker

import "time"

// SetInferredOfflineTimeout overrides the package-level timeout for tests.
// Returns a func that restores the original value.
func SetInferredOfflineTimeout(d time.Duration) func() {
	old := inferredOfflineTimeout
	inferredOfflineTimeout = d
	return func() { inferredOfflineTimeout = old }
}

// NewWithAccountID creates a Tracker with an explicit accountID (for tests).
func NewWithAccountID(accountID int64, d Deps) *Tracker {
	return newTracker(accountID, d)
}
