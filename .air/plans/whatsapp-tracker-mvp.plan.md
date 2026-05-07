# WhatsApp Number Status Tracker — Initial Plan

## Context

A personal tool that logs into your own WhatsApp account via WhatsApp Web (QR or phone-pairing code), watches a list of contacts you manually add, and records online/offline transitions, last-seen timestamps, profile-picture changes, and "About" text changes. Data lands in SQLite and is surfaced through a web dashboard so you can see patterns about a single contact or compare many. Directory `/Users/ibrahimalshekh/projects/go/whatsapp-tracker` is empty (clean `git init`) — we start from scratch. Scoped to a first working version you can iterate on.

## Stack

- **Backend**: Go single binary, `go.mau.fi/whatsmeow` (most mature multidevice library).
- **Frontend**: React + TypeScript via Vite. Embedded into Go binary with `embed.FS`; Vite dev server proxied during development.
- **Storage**: Two SQLite files. `whatsmeow.db` owned by whatsmeow's `sqlstore`. `tracker.db` owned by us (contacts + history).
- **Presence**: event-driven via `events.Presence` + `SubscribePresence(jid)`, refreshed every ~5 min.
- **Profile pic & About**: polled on a configurable 10–20s ticker, spread across contacts.
- **Dashboard auth**: off by default for local; optional bearer token via env so the same binary deploys to a server later.

## Repo Layout

```
whatsapp-tracker/
├── cmd/tracker/main.go
├── internal/
│   ├── config/        # env+flags: data dir, polling interval, listen addr, optional bearer
│   ├── db/            # tracker.db wrapper, embedded migrations, typed queries
│   ├── wa/            # whatsmeow lifecycle: connect, QR, PairPhone, event hub
│   ├── tracker/       # subscription manager + presence consumer + pic/about pollers
│   ├── api/           # HTTP REST + WebSocket hub; embeds web/dist via embed.FS
│   └── stats/         # derived metrics over events
├── web/               # Vite + React + TS app
│   └── src/{pages,components,lib}
├── Makefile           # dev, build, run, test, migrate
├── go.mod
└── README.md
```

## SQLite Schema (tracker.db)

```sql
CREATE TABLE contacts (
  id INTEGER PRIMARY KEY,
  jid TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  display_name TEXT,
  added_at INTEGER NOT NULL,
  tracking_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE presence_events (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  state TEXT NOT NULL,                  -- 'available' | 'unavailable'
  last_seen INTEGER,
  observed_at INTEGER NOT NULL
);
CREATE INDEX idx_presence_contact_time ON presence_events(contact_id, observed_at);

CREATE TABLE profile_picture_history (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  picture_id TEXT, url TEXT, sha256 TEXT,
  captured_at INTEGER NOT NULL
);

CREATE TABLE about_history (
  id INTEGER PRIMARY KEY,
  contact_id INTEGER NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  text TEXT, set_at INTEGER,
  captured_at INTEGER NOT NULL
);

CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
```

`*_history` rows are inserted only when the value differs from the latest row.

## API Contract

REST (JSON):
- `GET  /api/auth/status` → `{ linked, ownJID? }`
- `POST /api/auth/qr` — start QR flow; QRs streamed over WS
- `POST /api/auth/phone` `{ phone }` → `{ code }` (from `PairPhone`)
- `POST /api/auth/logout`
- `GET  /api/contacts`, `POST /api/contacts`, `PATCH /api/contacts/:id`, `DELETE /api/contacts/:id`
- `GET  /api/contacts/:id/timeline?since=<unix>`
- `GET  /api/contacts/:id/stats?range=today|week|month`

WebSocket `/api/ws` envelopes (server → client):
- `auth.qr { image }`, `auth.linked { ownJID }`
- `presence { contactId, jid, state, lastSeen, observedAt }`
- `picture { contactId, jid, pictureId, url, capturedAt }`
- `about { contactId, jid, text, capturedAt }`

## Tracker Loop

- Single goroutine drains the whatsmeow event channel into typed handlers.
- On `events.Connected`: load all `tracking_enabled=1` contacts, `SubscribePresence` for each, start pic/about pollers.
- Pollers iterate contacts once per tick, sleeping `interval/N` between calls. Per-contact exponential backoff on errors, capped at 5m.
- 5-minute resub ticker re-issues `SubscribePresence` to handle silent drops.

## Frontend Pages

- **Login** — toggle QR (`qrcode.react`) vs Phone Code (input → display 8-char code). Listens to WS `auth.linked` to redirect.
- **Dashboard** — table of contacts with live presence dot, last seen, About preview, pic thumbnail. Add-contact form. Tracking toggle.
- **ContactDetail** — header, vertical timeline grouped by day, stats strip with `recharts` (online minutes/day + change counters).

Frontend deps (small): `react`, `react-dom`, `react-router-dom`, `@tanstack/react-query`, `recharts`, `qrcode.react`. Plain CSS for v1.

## Build & Dev

- `make dev` — Go on `:8080` and Vite on `:5173` in parallel; Vite proxies `/api` and `/api/ws`.
- `make build` — `npm ci && vite build` → `web/dist`, then `go build`. `internal/api` embeds `web/dist` via `//go:embed`.
- `make run` — runs binary; data dir `~/.local/share/whatsapp-tracker/`.
- CGO note: `mattn/go-sqlite3` requires `CGO_ENABLED=1`. Pure-Go fallback: `modernc.org/sqlite` if friction. Document in README.

## Critical whatsmeow APIs to Reuse

- `store/sqlstore.New` + `Container.GetFirstDevice`
- `whatsmeow.NewClient(device, log)`
- `cli.GetQRChannel(ctx)`, `cli.PairPhone(ctx, phone, true, whatsmeow.PairClientChrome, "WhatsApp Tracker")`
- `cli.SubscribePresence(ctx, jid)`
- `cli.GetProfilePictureInfo(ctx, jid, &whatsmeow.GetProfilePictureParams{Preview: false})`
- `cli.GetUserInfo(ctx, []types.JID{jid})` — returns `Status` (About text)
- `cli.AddEventHandler` — for `events.Presence`, `events.Connected`, `events.LoggedOut`

## Known Limitations (document in README)

- Contact-side privacy settings gate visibility. "Last Seen: Nobody" hides presence — WhatsApp behavior, not a bug.
- Non-official clients carry a non-zero ban risk; consider a secondary number.
- Aggressive polling can be flagged; default 15s is conservative.
- The device can be logged out from another phone at any time; surface that and re-auth gracefully.

## Milestones (each demoable)

1. **M1 — Scaffold + Login**: module, Vite app, Makefile. `auth/status`, QR flow, phone-pair flow, persisted session. Login page links both options.
2. **M2 — Contacts + Presence**: contacts CRUD; on Connected, subscribe + handle `events.Presence`; write `presence_events`; dashboard shows contacts with live presence via WS.
3. **M3 — Pollers + Timeline**: pic + About pollers writing history; ContactDetail with merged timeline.
4. **M4 — Stats + Polish**: stats endpoint + recharts; pause/resume toggle; optional bearer-token auth; README with limitations.

## Critical Files to Create

- `cmd/tracker/main.go`
- `internal/config/config.go`
- `internal/db/{db.go,migrations.go,queries.go}`
- `internal/wa/{client.go,events.go}`
- `internal/tracker/{tracker.go,pollers.go}`
- `internal/api/{server.go,auth.go,contacts.go,timeline.go,ws.go,static.go}`
- `internal/stats/stats.go`
- `web/src/pages/{Login,Dashboard,ContactDetail}.tsx`
- `web/src/components/{QRView,PhoneCodeView,ContactList,Timeline,StatsStrip}.tsx`
- `web/src/lib/{api.ts,ws.ts,types.ts}`
- `Makefile`, `go.mod`, `web/package.json`, `web/vite.config.ts`, `README.md`

## Verification

- **M1**: `make dev`, open `http://localhost:5173`, scan QR → dashboard shows linked; `whatsmeow.db` has session rows. Re-run without re-scan — auto-reconnects. Repeat with phone-code path.
- **M2**: add a contact, toggle online/offline on a second device, watch live update + `presence_events` accumulate.
- **M3**: change pic + About on the test phone; after one tick, new `profile_picture_history` / `about_history` rows and timeline entries appear.
- **M4**: `GET /api/contacts/:id/stats?range=week` matches the timeline; `tracking_enabled=0` makes pollers skip that contact.
- **Build**: `make build` produces a single binary that serves the dashboard without `web/dist` on disk (proves embed).
