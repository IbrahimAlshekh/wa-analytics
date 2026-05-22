# Development Guide

## Requirements

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Go | 1.22 | `CGO_ENABLED=1` required (go-sqlite3) |
| Node | 20 | |
| pnpm | 10 | `corepack enable pnpm` |
| C toolchain | any | macOS: Xcode CLT (`xcode-select --install`); Linux: `gcc make`; Windows: MinGW-w64 |

## Dev Server

```bash
make web-install   # install JS deps (once)
make dev           # Vite on :5173 + Go API on :8080, Vite proxies /api and /api/ws
```

Open <http://localhost:5173>. On first run (no users in DB) you land on the **register** page.

The `WT_DEV=true` flag is set automatically by `make dev`, which enables permissive CORS so the Vite dev server can call the API on a different port.

## Build

```bash
make build   # web build → embed → go build → bin/tracker
```

Steps:
1. `make web-build`: `pnpm build` inside `web/` → `web/dist/` → copied to `internal/api/dist/`
2. `go build -o bin/tracker ./cmd/tracker` with `CGO_ENABLED=1`

The resulting binary is self-contained. No `web/dist/` is needed at runtime.

## Run Tests

```bash
make test                           # all packages
go test ./internal/analytics/...   # specific package
go test -v ./internal/db/...
```

## Project Layout

```
cmd/
  tracker/main.go              Entry point: wires config → db → wa → tracker → api
  analytics-backfill/main.go   CLI tool for retroactive analytics processing

internal/
  config/       Env var + flag parsing (config.go)
  crypto/       AES-256 field encryption helpers
  db/
    db.go       tracker.db init, WAL mode, migrations runner
    queries.go  All typed query functions
    migrations/ Numbered .sql files, embedded and run on startup
  wa/
    client.go   Single whatsmeow client wrapper (connect, pair, events)
    manager.go  Multi-account client map (JID → *Client)
  tracker/
    tracker.go  Presence handler, subscription manager, re-subscription loop
    poller.go   Picture and About pollers (spread across interval)
    messages.go Message ingest, history sync trigger
  analytics/
    engine.go   Incremental aggregation on message insert
    compute.go  Derived metric calculations (response times, streaks, etc.)
    backfill.go Full reprocess for existing message history
  api/
    server.go   Route registration, middleware, server struct
    handlers.go REST handler implementations
    hub.go      WebSocket fan-out broadcaster
    static.go   embed.FS for the SPA
  stats/
    stats.go    Range queries for online seconds and change counts

web/
  src/
    App.tsx               Root: WebSocket setup, React Query provider, routes
    lib/
      api.ts              All fetch wrappers (attaches token, handles refresh)
      store.ts            Zustand: JWT token, minimal UI state
      types.ts            TypeScript interfaces for all API responses
      media.ts            getMediaUrl helper
    components/
      ContactAvatar.tsx   Profile picture with fallback
      ...
    pages/
      Login.tsx
      Register.tsx
      Accounts.tsx
      AccountWorkspace.tsx
      ContactDetail.tsx   Tabs: Timeline, Stats, Analytics, Messages, Stories, Presence
      Messages.tsx
```

## Adding a REST Endpoint

1. Write a handler function in `internal/api/handlers.go` (or a new file if it's a new domain).
2. Register it in `Server.routes()` in `internal/api/server.go` with `r.Handle(...).Methods(...)` wrapped in `s.requireAuth`.
3. Add a typed fetch wrapper in `web/src/lib/api.ts`.
4. Use `useQuery` or `useMutation` from React Query in your component.

## Adding a WebSocket Message Type

1. Broadcast from Go: `s.hub.Broadcast("my_type", payload)` where `payload` is any JSON-serializable struct.
2. Add the TypeScript interface to `web/src/lib/types.ts`.
3. Add a `case "my_type":` in the WS message handler in `App.tsx`, calling `queryClient.invalidateQueries(...)` or updating state as needed.

## Adding a Database Table or Column

1. Create a new migration file in `internal/db/migrations/` with the next sequential number, e.g. `0013_my_change.sql`.
2. Write the SQL (`CREATE TABLE`, `ALTER TABLE ADD COLUMN`, etc.).
3. Add corresponding query functions to `internal/db/queries.go`.
4. The migration runs automatically on next startup.

**Never modify existing migration files** — they have already run on production instances. Always add a new file.

## Analytics Aggregation

When a new message is ingested in `internal/tracker/messages.go`, the analytics engine in `internal/analytics/engine.go` is called synchronously to update the relevant daily aggregation rows. The engine uses SQLite's `INSERT OR REPLACE` / upsert pattern on the daily tables.

To add a new metric:
1. Add a column to the appropriate migration (e.g. `analytics_daily`).
2. Update the detection/extraction logic in `engine.go`.
3. Update the `compute.go` derivations that read the aggregates.
4. Add the field to the API response struct and handler.
5. Add the TypeScript type and render it in the Analytics tab component.

## Environment Variables in Dev

Create a `.env` file in the project root (not `WT_DATA_DIR`) — `make dev` does not load it automatically. Pass vars directly:

```bash
WT_POLL_INTERVAL=30s WT_WA_LOG=DEBUG make dev
```

Or set them in your shell before running.

The `WT_APP_KEY` is auto-generated into `<WT_DATA_DIR>/.env` on first run and loaded from there at startup. You should not need to set it manually during development.
