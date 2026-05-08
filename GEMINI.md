# WhatsApp Tracker: Project Context

A private monitoring tool that tracks WhatsApp contacts' activity (online/offline status, profile pictures, and "About" updates) and logs messages. It supports multiple WhatsApp accounts and provides a web-based dashboard.

## Project Overview
- **Architecture**: Go backend with an embedded React frontend.
- **Backend**:
  - **WhatsApp Integration**: Uses `go.mau.fi/whatsmeow` to interface with the WhatsApp multidevice API.
  - **Storage**: Two SQLite databases: `whatsmeow.db` (session data) and `tracker.db` (contacts, presence history, and messages).
  - **Security**: Sensitive database fields (like phone numbers) are encrypted at rest using AES-GCM via a master `WT_APP_KEY` stored in `.env`.
  - **Real-time**: WebSocket hub for broadcasting presence updates and message events to the frontend.
  - **Auth**: Supports both JWT-based authentication for the dashboard and a static Bearer token for API/system access.
- **Frontend**:
  - React + TypeScript + Vite.
  - State management via `@tanstack/react-query`.
  - Visualizations using `recharts`.
  - Real-time updates via WebSocket.

## Key Directory Structure
- `cmd/tracker/`: Main entry point and CLI for user management.
- `internal/api/`: REST API handlers, WebSocket hub, and embedded static files for the SPA.
- `internal/wa/`: WhatsApp client manager and lifecycle (QR pairing, connection management).
- `internal/tracker/`: Core tracking logic, including presence event handling and polling loops for profile pictures/About text.
- `internal/db/`: Database operations, SQL migrations (embedded), and field-level encryption logic.
- `internal/config/`: Configuration loading (flags, env vars) and cryptographic key derivation.
- `web/`: React frontend source code.

## Building and Running

### Development
1. **Web Dependencies**: Install once with `make web-install`.
2. **Concurrent Dev**: Run `make dev`. This starts the Vite dev server (port 5173) and the Go backend (port 8080) with CORS enabled.

### Production
1. **Full Build**: Run `make build`. This compiles the React app into `internal/api/dist` and then builds the Go binary in `bin/tracker`.
2. **Run**: `./bin/tracker`. On first run, it generates a `.env` file in the data directory (default: `~/.local/share/whatsapp-tracker`) containing a unique `WT_APP_KEY`.

### User Management
The tracker requires a user account for dashboard access:
```bash
./bin/tracker user add <username>
```

## Development Conventions
- **Migrations**: SQL migrations are located in `internal/db/migrations/` and are automatically applied on startup.
- **Encryption**: Always use `db.enc()` and `db.dec()` when handling sensitive fields in the database to ensure they are stored securely.
- **Real-time Events**: New events should be broadcast via the `Hub` in `internal/api` so the frontend can react immediately.
- **Logging**: Uses `slog` with a custom `AuditHandler`. Audit logs (level `Error + 1`) are used for critical security/auth events.
- **Coding Style**: Standard Go idioms. Frontend follows modern React patterns with hooks and functional components.

## Configuration (Environment Variables)
| Variable | Description | Default |
| --- | --- | --- |
| `WT_DATA_DIR` | Directory for databases and .env | `~/.local/share/whatsapp-tracker` |
| `WT_APP_KEY` | 32-byte hex key for field encryption | (Generated on first run) |
| `WT_LISTEN` | HTTP listen address | `:8080` |
| `WT_BEARER` | Optional static API token | (None) |
| `WT_POLL_INTERVAL` | Cadence for polling profiles | `1m` |
| `WT_DEV` | Enable permissive CORS | `false` |
