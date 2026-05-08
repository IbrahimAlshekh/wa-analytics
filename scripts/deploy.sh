#!/bin/bash
set -e

SERVICE_NAME="whatsapp-tracker"
BIN_DEST="/usr/local/bin/whatsapp-tracker"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${WT_DATA_DIR:-$HOME/.local/share/whatsapp-tracker}"
ENV_FILE="$DATA_DIR/.env"

cd "$PROJECT_ROOT"

# Safety check: warn if .env is missing before proceeding.
if [ ! -f "$ENV_FILE" ]; then
    echo "WARNING: App key file not found at $ENV_FILE"
    echo "         If this is a fresh install, .env will be created on first start."
    echo "         If this is an existing install, something may be wrong — do NOT proceed"
    echo "         without your .env file, or encrypted data will be unrecoverable."
    read -p "Continue anyway? [y/N] " confirm
    if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
        echo "Aborted."
        exit 1
    fi
fi

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
