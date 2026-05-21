#!/bin/bash
set -e

# --- Arguments ---
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
    echo "Usage: $0 <domain> [email]"
    echo "  Example: $0 my-app.com admin@my-app.com"
    exit 1
fi

EMAIL="${2:-}"
if [ -z "$EMAIL" ]; then
    read -rp "Email for Let's Encrypt certificate notifications: " EMAIL
    if [ -z "$EMAIL" ]; then
        echo "Email is required for certbot registration."
        exit 1
    fi
fi

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
NGINX_CONF="/etc/nginx/sites-available/$SERVICE_NAME"

cd "$PROJECT_ROOT"

echo "--- Checking Dependencies ---"
sudo apt-get update

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

# Install nginx
if ! command -v nginx &> /dev/null; then
    echo "nginx not found. Installing..."
    sudo apt-get install -y nginx
fi

echo "--- Building WhatsApp Tracker ---"
make build

echo "--- Installing binary to $BIN_DEST ---"
sudo cp bin/tracker "$BIN_DEST"
sudo chmod +x "$BIN_DEST"

echo "--- Ensuring data directory exists ---"
mkdir -p "$DATA_DIR"
chmod 700 "$DATA_DIR"

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

echo "--- Configuring nginx for $DOMAIN ---"
cat <<EOF | sudo tee "$NGINX_CONF"
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Enable the site and disable the default placeholder
sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/$SERVICE_NAME
sudo rm -f /etc/nginx/sites-enabled/default

echo "--- Testing nginx configuration ---"
sudo nginx -t

echo "--- Starting nginx ---"
sudo systemctl enable nginx
sudo systemctl reload nginx || sudo systemctl start nginx

echo "--- Issuing SSL certificate for $DOMAIN ---"
echo "    Make sure $DOMAIN DNS A record points to this server's IP before continuing."
sudo certbot --nginx \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email "$EMAIL" \
    --redirect

echo "--- Reloading nginx after SSL ---"
sudo systemctl reload nginx

echo ""
echo "--- Setup Complete ---"
echo "Service is running on port $PORT (internal)"
echo "nginx is proxying https://$DOMAIN -> localhost:$PORT"
echo "SSL certificate auto-renewal is managed by certbot's systemd timer."
echo ""
echo "Check app status:   systemctl status $SERVICE_NAME"
echo "View app logs:      journalctl -u $SERVICE_NAME -f"
echo "Check nginx status: systemctl status nginx"
echo ""
echo "IMPORTANT — First run checklist:"
echo "  1. Add your first user:  $BIN_DEST user add <username>"
echo "  2. Back up your app key: cat $ENV_FILE"
echo "     Losing this file means encrypted data CANNOT be recovered."
echo ""
echo "After the service generates .env, reload it:"
echo "  sudo systemctl restart $SERVICE_NAME"
