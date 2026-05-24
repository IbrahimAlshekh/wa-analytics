# Testing Guide

## Running tests

```bash
# All layers (Go + web + demo)
make test-all

# Go only (race detector + coverage)
make test-go

# React frontend only
make test-web

# Demo app only
make test-demo

# Run a specific Go package
go test ./internal/analytics/... -race -v

# Run a specific frontend file (Vitest filter)
cd web && pnpm test:run src/lib/api.test.ts
cd web && pnpm test:run --reporter=verbose

# Coverage reports
cd web && pnpm test:coverage
cd demo && pnpm test:coverage
```

## Architecture

The test suite has three independent layers:

| Layer | Tool | Location |
|-------|------|----------|
| Go backend | `go test` + testify + httptest | `internal/*/` |
| React frontend | Vitest + RTL + MSW | `web/src/` |
| Demo app | Vitest + RTL | `demo/src/` |

## Go tests

### What is tested
- `internal/crypto/` — AES-256 round-trips, determinism, key derivation
- `internal/config/` — env-var parsing helpers
- `internal/tracker/` — WAClient interface, presence/message/picture handlers
- `internal/api/` — HTTP handlers (JWT, accounts, contacts, schedule, WS)
- `internal/db/` — migration, per-entity round-trips, analytics queries
- `internal/analytics/` — `Compute` end-to-end, initiation, util math
- `internal/stats/` — presence-series aggregation

### What is deliberately skipped
- The `whatsmeow` library internals (we test our interface seam)
- Generated proto types
- Raw migration SQL beyond what runs via `db.Open`

### Fakes and infrastructure
- `internal/testutil/db.go` — `OpenTestDB(t)` spins up an in-memory SQLite DB with migrations applied.
- `internal/testutil/hub.go` — `RecordingHub` captures broadcasts for assertion.
- `internal/testutil/jwt.go` — `TestJWT(t, key, username)` mints valid tokens.
- `internal/tracker/fake_wa_test.go` — `fakeWAClient` drives tracker event handlers without a real WhatsApp connection.
- No 3rd-party mock framework; hand-rolled fakes against narrow interfaces are cheaper and more stable.

### The `dist` placeholder
`internal/api/static.go` uses `//go:embed all:dist` which requires the `dist/` directory to exist at compile time. A `dist/.gitkeep` and `dist/index.html` placeholder are committed so `go test ./internal/api/...` compiles on a fresh clone before `make web-build` runs.

## Frontend tests

### Environment
Both `web/` and `demo/` use Vitest with a jsdom environment. The key configuration is in `vitest.config.ts`:

```ts
test: {
  environment: "jsdom",
  environmentOptions: { jsdom: { url: "http://localhost" } },
  setupFiles: ["./src/test/setup.ts"],
  globals: false,
  passWithNoTests: true,
}
```

`globals: false` means Vitest globals (`describe`, `it`, `expect`, etc.) are NOT injected — they must be imported. It also means RTL cannot auto-detect the framework for cleanup. `src/test/setup.ts` therefore calls `afterEach(() => cleanup())` explicitly.

The `url: "http://localhost"` option is required so that relative fetch URLs (`/api/accounts`) resolve correctly inside jsdom.

### HTTP mocking (MSW v2)
`src/test/mocks/server.ts` creates an MSW `setupServer` instance. Default handlers are in `handlers.ts` and return fixture data. Per-test overrides use `server.use(...)` which is automatically reset via `afterEach(() => server.resetHandlers())`.

```ts
// Override for a single test
server.use(
  http.post("/api/login", () => new HttpResponse(null, { status: 401 })),
);
```

### WebSocket mocking
`src/test/mocks/websocket.ts` exports `installMockWebSocket()`. It replaces `globalThis.WebSocket` with a controllable mock and returns helpers:

```ts
const { latest, instances, restore } = installMockWebSocket();
// ... render component that calls ws.start() ...
latest().triggerOpen();
latest().triggerMessage({ type: "presence", ... });
restore(); // restore original WebSocket
```

Use `Object.defineProperty` not direct assignment — jsdom's `globalThis.WebSocket` is read-only.

### Rendering
`src/test/utils.tsx` exports `renderWithProviders(ui, { route, queryClient })`. It wraps with:
- `QueryClientProvider` (`retry: false, gcTime: 0`)
- `I18nextProvider` (lng `"cimode"` — returns the translation key verbatim)
- `TooltipProvider` (required by Radix Tooltip used in PresencePanel)
- `MemoryRouter`

In cimode, `t("auth.login.username")` returns the string `"auth.login.username"`. Tests find elements by label text using these key strings.

### Module isolation for api/ws
`api.ts` and `ws.ts` read `localStorage` at import time and maintain module-level singletons. Tests that need fresh state use `vi.resetModules()` before a dynamic import:

```ts
async function importApi() {
  vi.resetModules();
  const { api } = await import("./api");
  return api;
}
```

### Extracting helpers for testability
Pure functions inlined in large components are hard to unit-test. We extract them:

| Extracted to | From component |
|-------------|---------------|
| `lib/sessions.ts` | `buildBlocks`, `formatTime`, `formatDuration` from `Timeline.tsx` |
| `lib/presence-stats.ts` | All `compute*` helpers from `PresencePanel.tsx` |
| `lib/schedule.ts` | `minutesToTime`, `timeToMinutes` from `Accounts.tsx` |

The component becomes a thin presentation layer; the library files have focused unit tests.

### What is deliberately skipped
- shadcn `ui/*` primitives (already tested by Radix/shadcn upstream)
- i18n string content (tested via key presence in cimode)
- Recharts visual output
- Demo-specific mock data volume/shape (only determinism properties are tested)

## Demo tests

The demo app is a browser-only copy of `web/` where `api.ts`, `ws.ts`, and `mockData.ts` use in-memory data instead of a real backend. Additional tests cover:

- `mockData.test.ts` — seedRng determinism via stable cache: same inputs → same output across multiple calls.
- `mockEvents.test.ts` — `registerTrigger` / `pushEvent` contract.
- `ws.test.ts` — `MockWSHub` start/idempotency/unsubscribe + auto-events via fake timers.
- `api.test.ts` — demo API responses: login accepts any credentials, sendMessage mutates in-memory store.

## CI

`.github/workflows/test.yml` runs three parallel jobs on every pull request:

| Job | Command |
|-----|---------|
| `go-test` | `CGO_ENABLED=1 go test -race -count=1 ./...` |
| `web-test` | `cd web && pnpm test:run` |
| `demo-test` | `cd demo && pnpm test:run` |

The Go job requires `CGO_ENABLED=1` because `go-sqlite3` uses cgo. On a fresh clone, `internal/api/dist/.gitkeep` and `dist/index.html` satisfy the `//go:embed` constraint without needing a frontend build first.
