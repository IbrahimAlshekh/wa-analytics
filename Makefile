SHELL := /bin/bash

GO_PKG := ./...
BIN := bin/tracker
MIGRATE_BIN := bin/migrate-encryption
BACKFILL_BIN := bin/analytics-backfill

.PHONY: dev build build-migrate build-backfill run test tidy web-install web-build clean deploy

dev:
	@( cd web && (test -d node_modules || pnpm install) && pnpm dev ) & \
	  GO_PID=$$!; \
	  CGO_ENABLED=1 go run ./cmd/tracker; \
	  kill $$GO_PID 2>/dev/null || true

web-install:
	cd web && pnpm install

web-build:
	# pnpm v11 requires approve-builds AFTER packages are in the local store.
	# Pass 1: download everything (exits non-zero if build scripts blocked — that's ok).
	# Pass 2: approve esbuild now that it's in the store, then reinstall + build.
	cd web && (pnpm install --no-frozen-lockfile || true) && (pnpm approve-builds esbuild || true) && pnpm install --no-frozen-lockfile && pnpm build

build: web-build
	mkdir -p bin
	CGO_ENABLED=1 go build -o $(BIN) ./cmd/tracker

# Build the one-time encryption migration tool.
# Run ./bin/migrate-encryption once after the first deployment with encryption support.
build-migrate:
	mkdir -p bin
	CGO_ENABLED=1 go build -o $(MIGRATE_BIN) ./cmd/migrate-encryption

# Build the analytics backfill tool.
# Run ./bin/analytics-backfill once after deploying analytics support.
build-backfill:
	mkdir -p bin
	CGO_ENABLED=1 go build -o $(BACKFILL_BIN) ./cmd/analytics-backfill

run: build
	./$(BIN)

test:
	go test $(GO_PKG)

tidy:
	go mod tidy

deploy:
	ansible-playbook ansible/deploy.yml -i ansible/inventory.ini

clean:
	rm -rf bin web/dist web/node_modules
