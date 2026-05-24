package api

import "time"

// SetWSAuthTimeout overrides the WS auth deadline for tests. Returns a restore func.
func SetWSAuthTimeout(d time.Duration) func() {
	old := wsAuthTimeout
	wsAuthTimeout = d
	return func() { wsAuthTimeout = old }
}

// SetWSPingPeriod overrides the WS ping ticker for tests. Returns a restore func.
func SetWSPingPeriod(d time.Duration) func() {
	old := wsPingPeriod
	wsPingPeriod = d
	return func() { wsPingPeriod = old }
}

// SetWSClientBuffer overrides the per-client send buffer size for tests. Returns a restore func.
func SetWSClientBuffer(n int) func() {
	old := wsClientBuffer
	wsClientBuffer = n
	return func() { wsClientBuffer = old }
}
