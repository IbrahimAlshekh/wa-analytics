package wa

import "go.mau.fi/whatsmeow/types/events"

// Convenience aliases so callers don't need to import whatsmeow/types/events directly.
type (
	EventConnected = events.Connected
	EventDisconnected = events.Disconnected
	EventLoggedOut    = events.LoggedOut
	EventPairSuccess  = events.PairSuccess
	EventPresence     = events.Presence
)
