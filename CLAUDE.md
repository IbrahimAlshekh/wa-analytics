# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install frontend deps (pnpm required)
make web-install

# Dev mode: starts Vite (port 5173) + Go API (port 8080) concurrently
# Vite proxies /api and /api/ws to :8080
make dev

# Production build: React → internal/api/dist → embedded in Go binary at bin/tracker
make build

# Run all tests
make test

# Run tests for a specific package
go test ./internal/analytics/...
```

Build requires CGO_ENABLED=1 (for go-sqlite3). Requires Go 1.22+, Node 20+, pnpm 10+, and a C toolchain.

## Architecture

**Single binary:** The React SPA is embedded via `//go:embed all:dist` in `internal/api/static.go`. After `make web-build`, the frontend lives inside the Go binary — no separate web server is needed in production.

**Entry point:** `cmd/tracker/main.go` wires all subsystems: config → DB → WhatsApp manager → tracker → HTTP server. All subsystems are initialized here and injected by value/reference.

**Three-layer Go backend:**
1. `internal/wa/` — Wraps the `whatsmeow` library; manages per-account WhatsApp connections, auth (QR/phone), and raw event emission.
2. `internal/tracker/` — Subscribes to WA events, runs picture/about polling goroutines, writes events to DB, and broadcasts via the WebSocket hub.
3. `internal/api/` — HTTP/WebSocket server (gorilla/mux + gorilla/websocket); handles REST endpoints, JWT auth, and real-time broadcast to browser clients.

**Real-time flow:** whatsmeow event → `internal/tracker/` handler → DB write + `hub.Broadcast(type, payload)` → WebSocket JSON push → React Query cache invalidation (in `web/src/App.tsx`'s WS listener).

**Multi-account:** All data models carry `account_id`. The tracker manager (`internal/wa/manager.go`) maintains a map of JID → client. API routes are nested under `/api/accounts/{id}/contacts/{cid}/...`.

**Database:** Two SQLite files in `WT_DATA_DIR` (default `~/.local/share/whatsapp-tracker`):
- `tracker.db` — application data; migrations in `internal/db/migrations/` are embedded and run in sorted order on startup.
- `whatsmeow.db` — WhatsApp session storage managed by the whatsmeow library; losing it requires re-pairing.

**Encryption:** `WT_APP_KEY` (64-char hex, auto-generated into `.env` on first run) is split into a JWT signing key and a DB field encryption key. The `internal/crypto/` package handles AES-256 encryption for sensitive fields. **Losing this key makes all encrypted data unrecoverable.**

**Config:** Loaded by `internal/config/config.go` from env vars and a `.env` file. Key vars: `WT_DATA_DIR`, `WT_LISTEN`, `WT_POLL_INTERVAL` (default 1m), `WT_APP_KEY`, `WT_DEV` (enables permissive CORS for Vite).

## Frontend

**Stack:** React 18, React Query 5, Zustand, Recharts, Vite. Build output goes to `web/dist/` which is copied to `internal/api/dist/`.

**State:** Zustand (`web/src/lib/store.ts`) holds the JWT token (persisted in localStorage) and minimal UI state. All server state is React Query.

**API calls:** All fetch requests go through `web/src/lib/api.ts`, which attaches the Bearer token and silently refreshes JWTs before expiry.

**WebSocket:** A single WS connection is established in `App.tsx` on mount. Incoming messages trigger React Query cache invalidations (`queryClient.invalidateQueries`) — there is no separate client-side state store for WS events.

**Media:** All profile images are served locally from `/media/`. Never reference external CDN URLs. Use the `getMediaUrl` helper in `web/src/lib/media.ts` and the `ContactAvatar` component for profile pictures.

## Extending the App

**New REST endpoint:** Add a handler to `internal/api/`, register it in `Server.routes()` in `internal/api/server.go` with `requireAuth` middleware, add a fetch wrapper in `web/src/lib/api.ts`, and use React Query in the component.

**New WebSocket message type:** Broadcast from Go with `hub.Broadcast("kind", payload)`, add the TypeScript interface to `web/src/lib/types.ts`, and add a `case "kind":` in the WS handler in `App.tsx`.

**New DB table/column:** Add a numbered SQL file to `internal/db/migrations/` (e.g. `0012_name.sql`) — it runs automatically on next startup. Add query functions to `internal/db/queries.go`.

**Polling cadence:** The minimum poll interval is 5 seconds (`WT_POLL_INTERVAL`). The tracker staggers contacts across the interval to avoid bursts. Aggressive polling risks account flagging by WhatsApp.
