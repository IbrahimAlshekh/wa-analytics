#!/bin/bash
set -e

# Configuration
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SERVICE_NAME="whatsapp-tracker"
PORT="8888"
BIN_DEST="/usr/local/bin/whatsapp-tracker"
USER=$(whoami)
WORKDIR="$PROJECT_ROOT"
DATA_DIR="${WT_DATA_DIR:-$HOME/.local/share/whatsapp-tracker}"
ENV_FILE="$DATA_DIR/.env"

cd "$PROJECT_ROOT"

echo "--- Checking Dependencies ---"
sudo apt-get update

# Install build tools (make, gcc for CGO)
echo "Ensuring build tools (make, gcc, curl) are installed..."
sudo apt-get install -y build-essential curl git software-properties-common

# Install Go
if ! command -v go &> /dev/null; then
    echo "Go not found. Installing..."
    sudo add-apt-repository -y ppa:longsleep/golang-backports
    sudo apt-get update
    sudo apt-get install -y golang-go
fi

# Install Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Install pnpm
if ! command -v pnpm &> /dev/null; then
    echo "pnpm not found. Installing..."
    sudo npm install -g pnpm
fi

echo "--- Building WhatsApp Tracker ---"
make build

echo "--- Installing binary to $BIN_DEST ---"
sudo cp bin/tracker "$BIN_DEST"
sudo chmod +x "$BIN_DEST"

echo "--- Ensuring data directory exists ---"
mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"

# The app generates .env with a random app key on first run.
# If it already exists, leave it alone (never overwrite — key loss = data loss).
if [ ! -f "$ENV_FILE" ]; then
    echo ""
    echo "NOTE: $ENV_FILE does not exist yet."
    echo "      It will be auto-generated with a random app key on first start."
    echo "      CRITICAL: Back it up immediately after first run."
    echo ""
fi

echo "--- Creating systemd service file ---"
cat <<EOF | sudo tee /etc/systemd/system/$SERVICE_NAME.service
[Unit]
Description=WhatsApp Tracker Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORKDIR
# Load .env from the data directory. The '-' prefix means missing file is not an error
# (the app will generate it on first run and systemd will pick it up on restart).
EnvironmentFile=-$ENV_FILE
Environment=WT_DATA_DIR=$DATA_DIR
ExecStart=$BIN_DEST --listen :$PORT --enable-logs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

echo "--- Starting service ---"
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

echo ""
echo "--- Setup Complete ---"
echo "Service is running on port $PORT"
echo "Check status with:  systemctl status $SERVICE_NAME"
echo "View logs with:     journalctl -u $SERVICE_NAME -f"
echo ""
echo "IMPORTANT — First run checklist:"
echo "  1. Add your first user:  $BIN_DEST user add <username>"
echo "  2. Back up your app key: cat $ENV_FILE"
echo "     Losing this file means encrypted data CANNOT be recovered."
echo ""
echo "After the service generates .env, reload it:"
echo "  sudo systemctl restart $SERVICE_NAME"
