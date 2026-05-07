# WhatsApp Tracker

A personal tool that logs into your own WhatsApp account, watches a list of contacts you add, and records:

- online / offline transitions and last-seen timestamps
- profile picture changes
- "About" text changes

Data lands in two SQLite files and is surfaced through an embedded React dashboard. Single Go binary at runtime.

## Stack

- **Backend:** Go (`go.mau.fi/whatsmeow`), `gorilla/websocket`, embedded SPA via `embed.FS`.
- **Frontend:** React + TypeScript via Vite, `@tanstack/react-query`, `recharts`, `qrcode.react`.
- **Storage:** Two SQLite databases per data dir — `whatsmeow.db` (whatsmeow-owned session) and `tracker.db` (contacts + history).

## Requirements

- Go 1.22+ (1.25 used here)
- Node 20+ / [pnpm](https://pnpm.io/) 10+
- A C toolchain — `mattn/go-sqlite3` requires `CGO_ENABLED=1`. On macOS, Xcode CLT is enough.

## Quick start (dev)

```bash
# Install web deps once
make web-install

# Run Vite (5173) + Go API (8080) together. Vite proxies /api and /api/ws.
make dev
```

Open <http://localhost:5173>. Pick QR or Phone Code on the Login page. Once linked, the dashboard appears.

## Build & run a single binary

```bash
make build           # builds web/ → internal/api/dist, then go build → bin/tracker
./bin/tracker        # serves dashboard + API on :8080, data in ~/.local/share/whatsapp-tracker
```

The Go binary contains the entire SPA via `//go:embed all:dist` in `internal/api/static.go`. No `web/dist` directory needs to be present at runtime.

## Configuration

All settings can be passed by flag or env var:

| Flag | Env | Default | Notes |
| --- | --- | --- | --- |
| `-data` | `WT_DATA_DIR` | `~/.local/share/whatsapp-tracker` | Where SQLite files live. |
| `-listen` | `WT_LISTEN` | `:8080` | HTTP listen address. |
| `-poll` | `WT_POLL_INTERVAL` | `15s` | Picture / About polling cadence. Min 5s. |
| `-bearer` | `WT_BEARER` | (empty) | Optional bearer token. Required on every `/api` request and on the WebSocket (`?token=`) when set. |
| `-dev` | `WT_DEV` | `false` | Enables permissive CORS so the Vite dev server can hit the API directly. |
| `-walog` | `WT_WA_LOG` | `INFO` | whatsmeow log level: `DEBUG`/`INFO`/`WARN`/`ERROR`. |

## Auth flows

- **QR**: `POST /api/auth/qr` → server starts whatsmeow's QR channel and broadcasts each code over `/api/ws` as `{ type: "auth.qr", code }`. The dashboard renders it with `qrcode.react`.
- **Phone code**: `POST /api/auth/phone {phone}` → returns the 8-character pairing code. Enter it on your phone (Linked devices → Link with phone number).

After either flow, `events.Connected` fires, the tracker subscribes to presence for every `tracking_enabled=1` contact, and the dashboard receives live updates.

## API

```
GET  /api/auth/status                 -> { linked, connected, ownJID }
POST /api/auth/qr                     -> 202 { started: true } (QR codes via WS)
POST /api/auth/phone   {phone}        -> { code }
POST /api/auth/logout                 -> { ok: true }

GET    /api/contacts
POST   /api/contacts                  {phone, displayName?}
PATCH  /api/contacts/:id              {displayName?, trackingEnabled?}
DELETE /api/contacts/:id

GET /api/contacts/:id/timeline?since=<unix>
GET /api/contacts/:id/stats?range=today|week|month

GET /api/ws       -- WebSocket envelopes:
  auth.qr    { code }
  auth.linked{ ownJID }
  auth.logout{ reason }
  presence   { contactId, jid, state, lastSeen?, observedAt }
  picture    { contactId, jid, pictureId, url, capturedAt }
  about      { contactId, jid, text, capturedAt }
```

If `WT_BEARER` is set, send `Authorization: Bearer <token>` on REST and append `?token=<token>` to the WebSocket URL.

## How it works

- **Presence**: event-driven via `events.Presence` + `cli.SubscribePresence(jid)`. Subscriptions are re-issued every 5 minutes so silent drops re-arm. Identical state re-emits collapse before hitting SQLite.
- **Picture / About pollers**: every contact is polled once per `WT_POLL_INTERVAL`, with calls spread evenly across the interval. New rows are inserted only when the value differs from the latest stored one.
- **Live updates**: every state change writes to SQLite *and* broadcasts over the WebSocket. The dashboard re-fetches the relevant queries via React Query.

## Limitations & risks

- **Privacy settings gate visibility.** If a contact has "Last Seen: Nobody" or has blocked you, presence and About won't be visible — that's WhatsApp's behavior, not a bug. Profile pictures fall back to a 404.
- **Ban risk.** Non-official multidevice clients carry a non-zero risk of having the account flagged. Use a secondary number you can afford to lose.
- **Polling is conservative.** Default 15s; do not push it below 5s. Aggressive scraping can be flagged.
- **Remote logout.** The device can be unlinked at any time from your phone. The dashboard catches `events.LoggedOut` and bumps you back to /login.
- **Single device.** This stores one whatsmeow session per data dir.

## Project layout

```
cmd/tracker/main.go         entry point: config → db → wa → tracker → http
internal/config/            env+flag parsing
internal/db/                tracker.db wrapper, embedded migrations, typed queries
internal/wa/                whatsmeow lifecycle (QR, PairPhone, event hub)
internal/tracker/           subscription manager + presence consumer + pic/about pollers
internal/api/               REST + WebSocket; embeds the SPA from internal/api/dist/
internal/stats/             range → online seconds per day, change counters
web/                        Vite + React + TS app (builds into internal/api/dist)
```

## License

Personal use; no affiliation with WhatsApp / Meta.
