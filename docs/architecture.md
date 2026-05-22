# Architecture

## System Overview

WA Analytics is a single Go binary with an embedded React SPA. At runtime there are no external services — just the binary and two SQLite files.

```mermaid
graph TB
    subgraph Browser["Browser (React SPA)"]
        RQ["React Query\n(server state)"]
        ZS["Zustand\n(JWT + UI state)"]
        RC["Recharts\n(visualizations)"]
    end

    subgraph API["internal/api/"]
        Router["gorilla/mux\nREST router"]
        Hub["WebSocket Hub\nfan-out broadcaster"]
        Static["embed.FS\nSPA static files"]
        Auth["JWT middleware"]
    end

    subgraph Tracker["internal/tracker/"]
        Presence["Presence handler\n+ subscription manager"]
        Pollers["Picture & About\npollers"]
        Messages["Message ingestion"]
        Analytics["Analytics engine"]
    end

    subgraph WA["internal/wa/"]
        Manager["Account manager\nJID → Client map"]
        Client["whatsmeow client\nper account"]
    end

    Browser -- "REST /api/..." --> Router
    Browser -- "WS /api/ws" --> Hub
    Hub -- "JSON push" --> Browser

    Router --> Tracker
    Router --> Auth

    Tracker --> Hub
    Tracker --> TrackerDB[("tracker.db")]
    Tracker --> WA

    WA --> Manager
    Manager --> Client
    Client --> WADB[("whatsmeow.db")]
    Client -- "multi-device\nprotocol" --> WhatsApp["WhatsApp\nServers"]
    WhatsApp -- "events" --> Client
```

---

## Three-Layer Backend

### `internal/wa/` — WhatsApp Layer

Wraps the [`whatsmeow`](https://github.com/tulir/whatsmeow) library. Responsibilities:

- **Account manager** (`manager.go`): maintains a `map[JID → *Client]`, starts/stops clients as accounts are added or removed.
- **Client lifecycle**: connects to WhatsApp, handles reconnection, emits raw events.
- **Pairing**: QR code flow and phone number pairing code flow.
- **Event bus**: forwards `events.Presence`, `events.Message`, `events.Picture`, `events.PushName`, `events.LoggedOut`, etc. to the tracker layer.

This layer has no knowledge of the database or HTTP layer.

### `internal/tracker/` — Business Logic Layer

Subscribes to WA events and owns all data collection logic:

- **Presence handler**: receives `events.Presence`, deduplicates consecutive identical states, writes to `presence_events`, broadcasts over WS.
- **Picture poller**: polls every contact once per `WT_POLL_INTERVAL`, compares SHA-256 hashes, writes new rows to `profile_picture_history`, stores image locally, broadcasts.
- **About poller**: same cadence, checks "About" text changes, writes to `about_history`.
- **Message handler**: receives `events.Message`, writes to `messages` and `message_events`, triggers analytics aggregation.
- **Analytics engine** (`internal/analytics/`): incrementally updates `analytics_daily` and related tables on each new message.
- **Subscription manager**: calls `SubscribePresence(jid)` for every `tracking_enabled=1` contact, and re-subscribes every 5 minutes to recover from silent drops.

### `internal/api/` — HTTP / WebSocket Layer

Handles all client-facing concerns:

- **Router** (`server.go`): registers all routes under `gorilla/mux`, applies `requireAuth` JWT middleware.
- **REST handlers**: thin wrappers around DB queries; no business logic here.
- **WebSocket hub** (`hub.go`): fan-out broadcaster. Each connected browser client gets its own goroutine. Slow clients get messages dropped rather than blocking fast ones.
- **Static serving**: the compiled `web/dist/` directory is embedded via `//go:embed all:dist` in `static.go`. All unknown routes serve `index.html` for client-side routing.

---

## Real-Time Event Flow

This sequence shows what happens from a WhatsApp event (e.g. a contact coming online) to the browser re-rendering.

```mermaid
sequenceDiagram
    participant WA as WhatsApp Servers
    participant Client as internal/wa/client
    participant Tracker as internal/tracker/
    participant DB as tracker.db
    participant Hub as WebSocket Hub
    participant Browser as Browser

    WA->>Client: events.Presence (available)
    Client->>Tracker: emit event

    Tracker->>Tracker: deduplicate\n(same state as last? skip)
    Tracker->>DB: INSERT presence_events
    Tracker->>Hub: hub.Broadcast("presence", payload)

    Hub->>Browser: WebSocket JSON push
    Browser->>Browser: queryClient.invalidateQueries(["timeline"])
    Browser->>Browser: Component re-renders
```

---

## Presence Subscription Lifecycle

```mermaid
sequenceDiagram
    participant API as internal/api/
    participant Tracker as internal/tracker/
    participant WA as internal/wa/
    participant WhatsApp as WhatsApp Servers

    Note over Tracker: On startup
    Tracker->>DB: SELECT contacts WHERE tracking_enabled=1
    loop For each tracked contact
        Tracker->>WA: SubscribePresence(jid)
        WA->>WhatsApp: Subscribe request
    end

    Note over Tracker: Every 5 minutes (drift recovery)
    loop Re-subscription tick
        Tracker->>WA: SubscribePresence(jid) for all contacts
    end

    Note over API: User toggles tracking on
    API->>Tracker: NotifyTrackingEnabled(contactId)
    Tracker->>WA: SubscribePresence(jid)
    WA->>WhatsApp: Subscribe request
```

---

## Picture & About Polling

```mermaid
sequenceDiagram
    participant Poller as Poller (ticker)
    participant WA as internal/wa/
    participant WhatsApp as WhatsApp Servers
    participant DB as tracker.db
    participant Hub as WebSocket Hub

    Note over Poller: Contacts spread evenly\nacross WT_POLL_INTERVAL

    loop Every slot tick
        Poller->>WA: GetProfilePicture(jid)
        WA->>WhatsApp: Request picture info
        WhatsApp-->>WA: pictureId + URL

        alt New picture (SHA-256 differs)
            WA->>WA: Download image
            Poller->>DB: INSERT profile_picture_history
            Poller->>Hub: hub.Broadcast("picture", payload)
        else Same picture
            Poller->>Poller: skip
        end

        Poller->>WA: GetUserInfo(jid) — About text
        alt About text changed
            Poller->>DB: INSERT about_history
            Poller->>Hub: hub.Broadcast("about", payload)
        end
    end
```

---

## Analytics Message Ingestion

```mermaid
flowchart TD
    MSG[New message event from WhatsApp] --> INGEST

    subgraph INGEST["internal/tracker/messages.go"]
        W[Write to messages table]
        E[Emit to WebSocket Hub]
    end

    INGEST --> ENGINE

    subgraph ENGINE["internal/analytics/engine.go"]
        DETECT["Detect features:\nemojis · words · domains\nhour · media type\nemotions · laughter · questions\ninitiation"]
        UPSERT["UPSERT daily aggregates"]
    end

    DETECT --> UPSERT

    UPSERT --> AD[(analytics_daily)]
    UPSERT --> AE[(analytics_emoji_daily)]
    UPSERT --> AW[(analytics_word_daily)]
    UPSERT --> ADom[(analytics_domain_daily)]
    UPSERT --> AH[(analytics_hour_daily)]

    QUERY["GET /analytics?range=month"] --> READ
    READ["Sum daily aggregates\nfor date range"] --> DERIVE
    DERIVE["Compute derived metrics:\nresponse times · streaks\nbalance % · initiation %\nsilent periods"] --> RESP[JSON response]
```

---

## Single Binary Build Pipeline

```mermaid
flowchart LR
    subgraph Frontend
        TS["web/src/\nTypeScript + React"]
        VITE["pnpm build\nVite"]
        DIST["web/dist/\nstatic assets"]
    end

    subgraph Backend
        GO["cmd/ + internal/\nGo source"]
        EMBED["//go:embed all:dist\ncompile + embed"]
    end

    TS --> VITE
    VITE --> DIST
    DIST --> COPY["copy to\ninternal/api/dist/"]
    COPY --> EMBED
    GO --> EMBED
    EMBED --> BIN["bin/tracker\nsingle self-contained binary\n~30–50 MB"]
```

---

## Multi-Account Model

```mermaid
graph LR
    Manager["wa.Manager\nmap[JID → Client]"]

    Manager --> C1["Client A\n(account 1)"]
    Manager --> C2["Client B\n(account 2)"]
    Manager --> C3["Client N\n(account N)"]

    C1 --> DB1[("account_id=1\ncontacts\npresence_events\nmessages\nanalytics")]
    C2 --> DB2[("account_id=2\ncontacts\npresence_events\nmessages\nanalytics")]
    C3 --> DB3[("account_id=N\n...")]

    note["All tables carry account_id.\nData is fully isolated per account."]
```

---

## Encryption Key Derivation

```mermaid
flowchart LR
    KEY["WT_APP_KEY\n64-char hex\n= 32 bytes"]

    KEY --> SPLIT["Split in half"]
    SPLIT --> JWT["First 32 bytes\nJWT signing key\nHMAC-SHA256"]
    SPLIT --> AES["Last 32 bytes\nDB field encryption key\nAES-256-GCM"]

    JWT --> TOKENS["Sign / verify\nlogin tokens"]
    AES --> FIELDS["Encrypt sensitive\nDB fields at rest"]

    NOTE["Auto-generated to .env on first run.\nLosing this key = all encrypted data unrecoverable."]
```

---

## Frontend

**Stack:** React 18, React Query 5, Zustand, Recharts, Vite.

- **State**: Zustand (`web/src/lib/store.ts`) holds the JWT token (persisted to `localStorage`) and minimal UI state. All server state is React Query.
- **API calls**: all fetch requests go through `web/src/lib/api.ts`, which attaches the Bearer token and silently refreshes JWTs 30 minutes before expiry.
- **WebSocket**: a single connection is established in `App.tsx` on mount. Incoming messages trigger `queryClient.invalidateQueries()` — there is no separate client-side state store for WS events.
- **Media**: all profile images are served from `/media/` on the local server. The `getMediaUrl` helper in `web/src/lib/media.ts` and the `ContactAvatar` component handle this consistently. External CDN URLs are never used.

---

## Analytics Pre-Aggregation

Rather than running expensive full-table scans on every analytics request, the tracker incrementally writes to a set of daily aggregation tables as messages arrive:

- `analytics_daily` — per-day, per-sender message/word/char/media counts and computed indicators
- `analytics_emoji_daily` — emoji frequency per day per sender
- `analytics_word_daily` — word frequency per day per sender
- `analytics_domain_daily` — shared domain frequency per day per sender
- `analytics_hour_daily` — hourly message counts per day per sender

The API reads and sums these aggregates to answer range queries (week/month/all-time), then computes derived metrics (response times, streaks, initiation percentages) on the fly. This keeps query times consistently fast even over years of data.

See [Database Schema](database.md) for the full table definitions.
