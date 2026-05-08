#!/bin/bash
set -e

SERVICE_NAME="whatsapp-tracker"
BIN_DEST="/usr/local/bin/whatsapp-tracker"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "--- Stopping service ---"
sudo systemctl stop "$SERVICE_NAME"

echo "--- Resetting to latest ---"
git fetch origin
git reset --hard origin/main

echo "--- Building ---"
make build

echo "--- Installing binary ---"
sudo cp bin/tracker "$BIN_DEST"
sudo chmod +x "$BIN_DEST"

echo "--- Starting service ---"
sudo systemctl start "$SERVICE_NAME"

echo "--- Done ---"
sudo systemctl status "$SERVICE_NAME" --no-pager
