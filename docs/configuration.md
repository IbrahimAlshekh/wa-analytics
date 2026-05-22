# Configuration

All settings can be provided as command-line flags or environment variables. Environment variables take precedence over defaults; flags take precedence over environment variables.

On startup, the app loads `<WT_DATA_DIR>/.env` if it exists, so you can store persistent settings there.

---

## Settings

| Flag | Env var | Default | Description |
|------|---------|---------|-------------|
| `-data` | `WT_DATA_DIR` | `~/.local/share/whatsapp-tracker` | Directory for both SQLite files and all media. Created on first run. |
| `-listen` | `WT_LISTEN` | `:8080` | HTTP listen address. Use `127.0.0.1:8080` to bind only to localhost (recommended behind a reverse proxy). |
| `-poll` | `WT_POLL_INTERVAL` | `15s` | Interval for profile picture and About polling. Minimum `5s`. Contacts are spread evenly across the interval. |
| `-bearer` | `WT_BEARER` | _(empty)_ | Optional static bearer token. When set, every API request must include `Authorization: Bearer <token>`, and the WebSocket URL must include `?token=<token>`. |
| `-dev` | `WT_DEV` | `false` | Enable permissive CORS. Set to `true` only when running the Vite dev server alongside the Go API. Never enable in production. |
| `-walog` | `WT_WA_LOG` | `INFO` | Log level for the whatsmeow library. Options: `DEBUG`, `INFO`, `WARN`, `ERROR`. Use `DEBUG` to diagnose connection issues. |

---

## The `.env` File

On first run, the app auto-generates `<WT_DATA_DIR>/.env` containing a random `WT_APP_KEY`. Example:

```dotenv
WT_APP_KEY=a1b2c3d4e5f6...  # 64-char hex
```

You can add other settings to this file:

```dotenv
WT_APP_KEY=a1b2c3d4e5f6...
WT_LISTEN=127.0.0.1:8080
WT_POLL_INTERVAL=30s
WT_BEARER=mysecrettoken
```

**Back up this file.** The `WT_APP_KEY` is used for:
- JWT signing (first 32 bytes)
- AES-256 database field encryption (last 32 bytes)

Losing it means JWT sessions are invalidated and encrypted fields are unrecoverable.

---

## Encryption Key (`WT_APP_KEY`)

The key must be exactly **64 hexadecimal characters** (32 bytes). To generate one manually:

```bash
openssl rand -hex 32
```

If `WT_APP_KEY` is not set when the app starts, a new one is generated and written to `<WT_DATA_DIR>/.env` automatically. After that first run, the generated key is loaded from that file on every subsequent start.

---

## Polling Interval Notes

The `WT_POLL_INTERVAL` controls how often the app checks each contact's profile picture and About text. Contacts are **spread evenly** across the interval to avoid request bursts.

For example, with 60 contacts and a 60s interval, one contact is polled every second. With 60 contacts and a 120s interval, one contact is polled every 2 seconds.

**Do not set this below `5s`.** Aggressive polling increases the risk of WhatsApp flagging the account. The default of `15s` is conservative and safe for most use cases.

---

## Running Behind a Reverse Proxy

When running behind Nginx or another reverse proxy, bind the app to localhost only:

```
WT_LISTEN=127.0.0.1:8080
```

The Ansible playbook and server scripts configure this automatically. The proxy handles TLS termination and forwards requests to `127.0.0.1:8080`.

WebSocket connections (`/api/ws`) require the proxy to forward the `Upgrade` and `Connection` headers. The included Nginx configuration handles this correctly.

---

## Example: Running Directly

```bash
./bin/tracker \
  -data /var/data/whatsapp-tracker \
  -listen 127.0.0.1:8080 \
  -poll 30s \
  -bearer mysecrettoken \
  -walog WARN
```

Or via environment variables:

```bash
export WT_DATA_DIR=/var/data/whatsapp-tracker
export WT_LISTEN=127.0.0.1:8080
export WT_POLL_INTERVAL=30s
export WT_BEARER=mysecrettoken
export WT_WA_LOG=WARN
./bin/tracker
```
