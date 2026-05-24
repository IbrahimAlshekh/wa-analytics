SHELL := /bin/bash

GO_PKG := ./...
BIN := bin/tracker
MIGRATE_BIN := bin/migrate-encryption
BACKFILL_BIN := bin/analytics-backfill

.PHONY: dev build build-migrate build-backfill run test test-go test-web test-demo test-all tidy web-install web-build demo-install demo-build demo run-demo clean setup deploy

dev:
	@( cd web && (test -d node_modules || pnpm install) && pnpm dev ) & \
	  GO_PID=$$!; \
	  CGO_ENABLED=1 go run ./cmd/tracker; \
	  kill $$GO_PID 2>/dev/null || true

web-install:
	cd web && pnpm install

web-build:
	# pnpm v11 requires approve-builds AFTER packages are in the local store.
	# Pass 1: download everything (build scripts may be blocked — that's ok).
	# Pass 2: approve whatever is pending, then reinstall + build.
	cd web && (pnpm install --no-frozen-lockfile || true) && (pnpm approve-builds --all || true) && pnpm install --no-frozen-lockfile && pnpm build

demo-install:
	cd demo && pnpm install

demo-build:
	cd demo && (pnpm install --no-frozen-lockfile || true) && (pnpm approve-builds --all || true) && pnpm install --no-frozen-lockfile && pnpm build

demo: demo-build

run-demo:
	cd demo && (test -d node_modules || pnpm install) && pnpm dev

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

test-go:
	CGO_ENABLED=1 go test -race -count=1 -coverprofile=coverage.out $(GO_PKG)

test-web:
	cd web && pnpm test --run

test-demo:
	cd demo && pnpm test --run

test-all: test-go test-web test-demo

test: test-all

tidy:
	go mod tidy

setup:
	ansible-playbook ansible/playbook.yml -i ansible/inventory.ini

deploy:
	ansible-playbook ansible/deploy.yml -i ansible/inventory.ini

clean:
	rm -rf bin web/dist web/node_modules demo/dist demo/node_modules
