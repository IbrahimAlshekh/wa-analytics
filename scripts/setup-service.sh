#!/bin/bash
set -e

# Configuration
SERVICE_NAME="whatsapp-tracker"
PORT="8888"
BIN_DEST="/usr/local/bin/whatsapp-tracker"
USER=$(whoami)
WORKDIR=$(pwd)
DATA_DIR="$HOME/.local/share/whatsapp-tracker"

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
