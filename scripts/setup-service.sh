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
DATA_DIR="$HOME/.local/share/whatsapp-tracker"

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

echo "--- Creating systemd service file ---"
cat <<EOF | sudo tee /etc/systemd/system/$SERVICE_NAME.service
[Unit]
Description=WhatsApp Tracker Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORKDIR
ExecStart=$BIN_DEST --listen :$PORT --enable-logs
Restart=always
RestartSec=10
Environment=WT_DATA_DIR=$DATA_DIR

[Install]
WantedBy=multi-user.target
EOF

echo "--- Starting service ---"
sudo systemctl daemon-reload
sudo systemctl enable $SERVICE_NAME
sudo systemctl restart $SERVICE_NAME

echo "--- Setup Complete ---"
echo "Service is running on port $PORT"
echo "Check status with: systemctl status $SERVICE_NAME"
echo "View logs with: journalctl -u $SERVICE_NAME -f"
echo ""
echo "CRITICAL: You must add an initial user to access the UI:"
echo "$BIN_DEST user add your_username your_password"
