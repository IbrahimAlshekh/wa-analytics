SHELL := /bin/bash

GO_PKG := ./...
BIN := bin/tracker

.PHONY: dev build run test tidy web-install web-build clean

dev:
	@( cd web && (test -d node_modules || pnpm install) && pnpm dev ) & \
	  GO_PID=$$!; \
	  CGO_ENABLED=1 go run ./cmd/tracker; \
	  kill $$GO_PID 2>/dev/null || true

web-install:
	cd web && pnpm install

web-build:
	cd web && (pnpm approve-builds esbuild || true) && pnpm install --no-frozen-lockfile && pnpm build

build: web-build
	mkdir -p bin
	CGO_ENABLED=1 go build -o $(BIN) ./cmd/tracker

run: build
	./$(BIN)

test:
	go test $(GO_PKG)

tidy:
	go mod tidy

clean:
	rm -rf bin web/dist web/node_modules
