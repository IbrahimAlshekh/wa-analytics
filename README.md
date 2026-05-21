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

Open <http://localhost:5173>. On first run (no users in the DB) you land on the **register** page — create an account, then log in. Once authenticated, pair a WhatsApp account via QR or phone code from the Accounts page.

## Build & run a single binary

```bash
make build           # builds web/ → internal/api/dist, then go build → bin/tracker
./bin/tracker        # serves dashboard + API on :8080, data in ~/.local/share/whatsapp-tracker
```

The Go binary contains the entire SPA via `//go:embed all:dist` in `internal/api/static.go`. No `web/dist` directory needs to be present at runtime.

## Local install (single machine)

The `scripts/local/` directory contains a cross-platform local installer — separate from the server deploy tooling. It installs the app as a user-level background service, maps a local domain, and embeds the logo as a native OS icon.

### Supported platforms

| OS | Service | Icon | DNS |
|---|---|---|---|
| Linux | systemd user unit (`systemctl --user`) | `.desktop` entry + hicolor icon | dnsmasq |
| macOS | launchd LaunchAgent | `.app` bundle with `.icns` | dnsmasq (brew) |
| Windows | NSSM service (or Scheduled Task fallback) | Embedded `.exe` icon | `hosts` file |

### Quick start

**Linux / macOS:**
```bash
./scripts/local/install.sh
```

**Windows (PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File scripts\local\install.ps1
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--yes` / `-AssumeYes` | off | Non-interactive; answer yes to all prompts |
| `--skip-deps` | off | Skip build-dependency installation |
| `--skip-build` | off | Skip build (use existing `bin/tracker`) |
| `--skip-service` | off | Skip background service setup |
| `--skip-dns` | off | Skip DNS / dnsmasq configuration |
| `--no-icon` | off | Skip native OS icon embedding |
| `--listen ADDR` | `:8080` | HTTP listen address |
| `--domain DOMAIN` | `wa-analytics.local` | Local domain to map |
| `--uninstall` | — | Remove the installation |

### What gets installed where

| | Linux | macOS | Windows |
|---|---|---|---|
| **Binary** | `~/.local/bin/tracker` | `~/Applications/WA Analytics.app` + symlink `~/.local/bin/tracker` | `%LOCALAPPDATA%\WhatsApp Tracker\tracker.exe` |
| **Service** | `~/.config/systemd/user/whatsapp-tracker.service` | `~/Library/LaunchAgents/com.whatsapptracker.tracker.plist` | NSSM service `WhatsAppTracker` |
| **Icon** | `~/.local/share/icons/hicolor/512x512/apps/whatsapp-tracker.png` + `.desktop` | `~/Applications/WA Analytics.app/Contents/Resources/tracker.icns` | Embedded in `tracker.exe` |
| **Data** | `~/.local/share/whatsapp-tracker/` | `~/.local/share/whatsapp-tracker/` | `%LOCALAPPDATA%\whatsapp-tracker\` |

### DNS — `wa-analytics.local` caveat

> **Important:** The `.local` TLD is reserved for mDNS / Bonjour (RFC 6762). On macOS and Linux desktops running Avahi, `.local` lookups may be intercepted by mDNS before they reach dnsmasq, causing unreliable resolution.
>
> The installer warns you and requires confirmation before applying DNS changes. To avoid this, use a different TLD:
> ```bash
> ./scripts/local/install.sh --domain wa-analytics.test   # safer
> ./scripts/local/install.sh --domain wa-analytics.lan
> ```
> On **Windows**, dnsmasq is not available — the installer adds a `hosts` file entry instead (requires admin).

### First-run checklist

After the service starts for the first time it auto-generates `<datadir>/.env` containing a random encryption key.

```bash
# 1. Create your first login user
tracker user add <username>

# 2. Back up your encryption key — CRITICAL
cat ~/.local/share/whatsapp-tracker/.env
```

Open `http://localhost:8080` (or your configured domain). The app redirects to the **register** page until your first user exists.

### Managing the service

**Linux:**
```bash
systemctl --user status whatsapp-tracker
systemctl --user stop   whatsapp-tracker
systemctl --user start  whatsapp-tracker
journalctl --user -u whatsapp-tracker -f
```

**macOS:**
```bash
launchctl print  gui/$(id -u)/com.whatsapptracker.tracker
launchctl stop   com.whatsapptracker.tracker
launchctl start  com.whatsapptracker.tracker
tail -f ~/.local/share/whatsapp-tracker/tracker.log
```

**Windows:**
```powershell
Get-Service WhatsAppTracker
nssm stop  WhatsAppTracker
nssm start WhatsAppTracker
```

### Uninstall

```bash
./scripts/local/uninstall.sh          # Linux / macOS
# Windows:
powershell -ExecutionPolicy Bypass -File scripts\local\uninstall.ps1
```

The data directory (`~/.local/share/whatsapp-tracker/`) is **never removed** — it contains your encryption key. Delete it manually once you are certain you no longer need the data.

### Troubleshooting

| Problem | Fix |
|---|---|
| `cgo: C compiler "gcc" not found` | Run `--skip-build` and install gcc manually, then re-run |
| `pnpm: command not found` | Run `corepack enable pnpm` after installing Node 20+ |
| Port already in use | Change with `--listen :9090` |
| `wa-analytics.local` doesn't resolve | Run with `--domain wa-analytics.test` (avoids mDNS conflict) |
| Service not starting | Check logs: `journalctl --user -u whatsapp-tracker` or `tracker.log` in data dir |
| macOS Xcode CLT installer dialog | Complete the dialog shown by the OS, then re-run `install.sh` |

---

## Deployment (server)

Two scripts handle **server** setup and ongoing deploys. These are in `scripts/server/` and are unrelated to the local install above.

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

Or with the Makefile shortcut:

```bash
make setup
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

**Pre-requisite:** the domain's DNS `A` record must point to the server before the playbook runs, or the certbot step will fail.

After the service starts for the first time it generates `~/.local/share/whatsapp-tracker/.env` with a random encryption key. **Back this file up immediately** — losing it makes all stored data unrecoverable.

```bash
# Back up the encryption key after first start
ssh root@<server> "cat /home/whatsapptracker/.local/share/whatsapp-tracker/.env"
```

Then open `https://<domain>` — because no user exists yet, the app redirects straight to the **register** page. Create your admin account there. Once an account exists, the register page is permanently closed; any further registration attempts are rejected by the server with `403`.

---

### Deploying updates

Once the initial setup is complete, use the dedicated deploy playbook instead of re-running the full `playbook.yml`. It skips all the setup steps and only does: **pull → build → install → restart**.

```bash
ansible-playbook ansible/deploy.yml -i ansible/inventory.ini
```

Or with the Makefile shortcut:

```bash
make deploy
```

The binary is only replaced if it actually changed, so `notify: Restart whatsapp-tracker` fires only when needed.

### Useful commands (server)

```bash
systemctl status whatsapp-tracker        # app health
journalctl -u whatsapp-tracker -f        # live app logs
systemctl status nginx                   # nginx health
certbot renew --dry-run                  # test cert renewal
```

### Manual server scripts (alternative to Ansible)

`scripts/server/` contains two shell scripts for servers where Ansible is not available:

| Script | Purpose |
|---|---|
| `scripts/server/setup-service.sh <domain> [email]` | One-time server setup: installs deps, builds, installs systemd service, configures nginx + Let's Encrypt SSL |
| `scripts/server/deploy.sh` | Deploys an update: stops service → `git pull` → build → install → restart |

These target **Ubuntu/Debian** servers and require `sudo`. They are **not** related to the local install scripts in `scripts/local/`.

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
