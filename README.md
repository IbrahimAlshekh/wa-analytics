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

## Deployment

Two scripts handle server setup and ongoing deploys.

### Ansible (recommended for remote servers)

The `ansible/` directory contains a fully idempotent playbook. It connects as **root**, installs all dependencies, creates a restricted `whatsapptracker` service account, and hands ownership of only what the service needs to that account.

**Security model:**

| Path | Owner | Mode | Notes |
|---|---|---|---|
| `/home/whatsapptracker/bin/whatsapp-tracker` | `root` | `0750` | Service can execute, not overwrite |
| `/home/whatsapptracker/.local/share/whatsapp-tracker/` | `whatsapptracker` | `0700` | App data + `.env` key |
| `/etc/systemd/system/whatsapp-tracker.service` | `root` | `0644` | System file |
| `/etc/nginx/sites-available/whatsapp-tracker` | `root` | `0644` | System file |

`whatsapptracker` has no login shell, no password, no sudo — it can only run the binary and write to its data directory. The systemd unit also enables `NoNewPrivileges`, `PrivateTmp`, and `ProtectSystem` hardening flags.

**1. Edit the inventory**

```ini
# ansible/inventory.ini
[whatsapp_tracker]
203.0.113.10 ansible_user=root ansible_ssh_private_key_file=~/.ssh/id_rsa

[whatsapp_tracker:vars]
domain=my-app.com
email=admin@my-app.com
repo_url=git@github.com:ibrahimalshekh/whatsapp-tracker.git
```

**2. Run the playbook**

```bash
ansible-playbook ansible/playbook.yml -i ansible/inventory.ini
```

Or pass everything on the command line:

```bash
ansible-playbook ansible/playbook.yml \
  -i "203.0.113.10," \
  -e "ansible_user=root" \
  -e "ansible_ssh_private_key_file=~/.ssh/id_rsa" \
  -e "domain=my-app.com" \
  -e "email=admin@my-app.com" \
  -e "repo_url=git@github.com:ibrahimalshekh/whatsapp-tracker.git"
```

The playbook is safe to re-run — it pulls latest code, rebuilds, reinstalls the binary (root-owned), and restarts the service. The TLS certificate step is skipped if a cert already exists.

**Pre-requisite:** the domain's DNS `A` record must point to the server before the playbook runs, or the certbot step will fail.

---

### First-time setup (manual shell script)

```bash
bash scripts/setup-service.sh <domain> [email]
```

**Example:**
```bash
bash scripts/setup-service.sh my-app.com admin@my-app.com
```

If you omit the email you will be prompted for one (required for Let's Encrypt registration).

What it does:

1. Installs system dependencies (Go, Node, pnpm, nginx, build tools) if missing.
2. Builds the binary and installs it to `/usr/local/bin/whatsapp-tracker`.
3. Creates and enables a systemd service that runs the app on port `8888`.
4. Writes an nginx reverse-proxy config for the domain and enables it.
5. Runs `certbot --nginx` to issue a TLS certificate and configure HTTPS with an automatic HTTP → HTTPS redirect. Certificate auto-renewal is handled by certbot's built-in systemd timer.

**Pre-requisite:** the domain's DNS `A` record must point to the server's IP before running — certbot's HTTP-01 challenge will fail otherwise.

After the service starts for the first time it generates `~/.local/share/whatsapp-tracker/.env` with a random encryption key. **Back this file up immediately** — losing it makes all stored data unrecoverable.

```bash
# Add your first user after first start
whatsapp-tracker user add <username>

# Back up the key
cat ~/.local/share/whatsapp-tracker/.env
```

### Deploying updates

```bash
bash scripts/deploy.sh
```

Stops the service, pulls `origin/main`, rebuilds, reinstalls the binary, restarts the service, and reloads nginx. Warns and prompts if the `.env` key file is missing before touching anything.

### Useful commands after setup

```bash
systemctl status whatsapp-tracker        # app health
journalctl -u whatsapp-tracker -f        # live app logs
systemctl status nginx                   # nginx health
certbot renew --dry-run                  # test cert renewal
```

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
