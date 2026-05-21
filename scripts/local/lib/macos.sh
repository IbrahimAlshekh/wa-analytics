#!/usr/bin/env bash
# macos.sh — macOS-specific install functions.
# Sourced by install.sh after common.sh. Requires REPO_ROOT, LISTEN, DOMAIN, DATA_DIR, EMBED_ICON.

readonly APP_BUNDLE="$HOME/Applications/WA Analytics.app"
readonly APP_BIN="$APP_BUNDLE/Contents/MacOS/tracker"
readonly LAUNCH_LABEL="com.whatsapptracker.tracker"
readonly LAUNCH_PLIST="$HOME/Library/LaunchAgents/${LAUNCH_LABEL}.plist"

# ── Step: install build dependencies ──────────────────────────────────────

os_install_build_deps() {
    # ---- Xcode Command Line Tools (supplies clang for CGO) ----
    if xcode-select -p &>/dev/null; then
        log_skip "Xcode Command Line Tools"
    else
        log_info "Installing Xcode Command Line Tools..."
        log_warn "A system dialog will appear. Please click 'Install' to proceed."
        log_warn "After the installation completes, re-run this script."
        xcode-select --install 2>/dev/null || true
        exit 0
    fi

    # ---- Homebrew ----
    if have_cmd brew; then
        log_skip "Homebrew"
    else
        log_info "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        # Add brew to current-session PATH (Apple Silicon or Intel)
        if [ -f "/opt/homebrew/bin/brew" ]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        elif [ -f "/usr/local/bin/brew" ]; then
            eval "$(/usr/local/bin/brew shellenv)"
        fi
        log_ok "Homebrew installed"
        log_warn "Add to your shell profile:  eval \"\$(brew shellenv)\""
    fi

    # ---- Go ----
    local go_have
    go_have=$(installed_go_version)
    if version_ge "$go_have" "$GO_MIN_VERSION"; then
        log_skip "Go $go_have (>= $GO_MIN_VERSION required)"
    else
        log_info "Installing Go via Homebrew..."
        brew install go
        log_ok "Go installed"
    fi

    # ---- Node ----
    local node_have
    node_have=$(installed_node_version)
    if version_ge "$node_have" "$NODE_MIN_VERSION"; then
        log_skip "Node $node_have (>= $NODE_MIN_VERSION required)"
    else
        log_info "Installing Node.js via Homebrew..."
        brew install node
        log_ok "Node.js installed"
    fi

    # ---- pnpm ----
    if have_cmd pnpm; then
        log_skip "pnpm"
    else
        log_info "Installing pnpm via corepack..."
        if have_cmd corepack; then
            corepack enable pnpm
        else
            npm install -g pnpm
        fi
        log_ok "pnpm installed"
    fi
}

# ── Step: build the project ────────────────────────────────────────────────

build_project() {
    log_info "Building web + Go binary..."
    cd "$REPO_ROOT"
    make build
    log_ok "Binary built at bin/tracker"
}

# ── Step: install the binary (.app bundle) ────────────────────────────────

os_install_binary() {
    local contents="$APP_BUNDLE/Contents"

    ensure_dir "$HOME/Applications"
    ensure_dir "$contents/MacOS"
    ensure_dir "$contents/Resources"

    # Copy binary
    install -m 755 "$REPO_ROOT/bin/tracker" "$APP_BIN"

    # Substitute Info.plist template
    sed \
        -e "s|@BIN_PATH@|${APP_BIN}|g" \
        -e "s|@LISTEN@|${LISTEN}|g" \
        -e "s|@DATA_DIR@|${DATA_DIR}|g" \
        "$REPO_ROOT/scripts/local/assets/Info.plist.tmpl" \
        > "$contents/Info.plist"

    # Touch bundle so Finder refreshes icon cache
    touch "$APP_BUNDLE"

    log_ok "App bundle → $APP_BUNDLE"

    # CLI symlink for 'tracker user add <username>' first-run step
    local link="$HOME/.local/bin/tracker"
    ensure_dir "$HOME/.local/bin"
    ln -sf "$APP_BIN" "$link"
    log_ok "CLI symlink → $link"

    if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
        log_warn "~/.local/bin is not in your PATH."
        log_warn "Add to your shell profile:  export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi
}

# ── Step: native OS icon (.icns in .app bundle) ────────────────────────────

os_embed_icon() {
    if [ "${EMBED_ICON:-1}" = "0" ]; then
        log_skip "OS icon (--no-icon)"
        return 0
    fi

    local icon_src="$REPO_ROOT/web/src/assets/wa_analytics_logo_512.png"
    local resources="$APP_BUNDLE/Contents/Resources"
    local iconset_dir
    iconset_dir=$(mktemp -d)
    local icns_dest="$resources/tracker.icns"

    [ -f "$icon_src" ] || { log_warn "Logo not found at $icon_src — skipping icon"; return 0; }
    have_cmd sips    || { log_warn "'sips' not found — skipping icon"; return 0; }
    have_cmd iconutil || { log_warn "'iconutil' not found — skipping icon"; return 0; }

    ensure_dir "$resources"

    local iconset="${iconset_dir}/tracker.iconset"
    mkdir -p "$iconset"

    # Generate all required icon sizes using built-in sips (no extra deps)
    for size in 16 32 64 128 256 512; do
        sips -z "$size" "$size" "$icon_src" --out "${iconset}/icon_${size}x${size}.png" &>/dev/null
        local double=$((size * 2))
        if [ "$double" -le 512 ]; then
            sips -z "$double" "$double" "$icon_src" --out "${iconset}/icon_${size}x${size}@2x.png" &>/dev/null
        fi
    done

    iconutil -c icns "$iconset" -o "$icns_dest"
    rm -rf "$iconset_dir"

    touch "$APP_BUNDLE"
    log_ok "Icon → $icns_dest"
}

# ── Step: launchd LaunchAgent ─────────────────────────────────────────────

os_install_service() {
    ensure_dir "$HOME/Library/LaunchAgents"
    ensure_dir "$DATA_DIR" "700"

    sed \
        -e "s|@BIN_PATH@|${APP_BIN}|g" \
        -e "s|@LISTEN@|${LISTEN}|g" \
        -e "s|@DATA_DIR@|${DATA_DIR}|g" \
        "$REPO_ROOT/scripts/local/assets/com.whatsapptracker.tracker.plist.tmpl" \
        > "$LAUNCH_PLIST"
    chmod 644 "$LAUNCH_PLIST"

    # Unload first to safely replace existing registration
    launchctl bootout "gui/$(id -u)/${LAUNCH_LABEL}" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$LAUNCH_PLIST"
    launchctl enable "gui/$(id -u)/${LAUNCH_LABEL}" 2>/dev/null || true

    log_ok "LaunchAgent installed and started"
    log_info "  Status:  launchctl print gui/$(id -u)/${LAUNCH_LABEL}"
    log_info "  Stop:    launchctl stop ${LAUNCH_LABEL}"
    log_info "  Start:   launchctl start ${LAUNCH_LABEL}"
    log_info "  Logs:    tail -f ${DATA_DIR}/tracker.log"
}

# ── Step: dnsmasq + domain ────────────────────────────────────────────────

os_configure_dns() {
    _print_dns_caveat

    if ! confirm "Map ${DOMAIN} → 127.0.0.1 on this machine?"; then
        log_skip "DNS configuration"
        log_info "You can still reach the app at http://localhost${LISTEN}"
        return 0
    fi

    # Install dnsmasq via brew
    if ! have_cmd dnsmasq; then
        log_info "Installing dnsmasq via Homebrew..."
        brew install dnsmasq
    else
        log_skip "dnsmasq already installed"
    fi

    local brew_prefix
    brew_prefix=$(brew --prefix)
    local dnsmasq_conf="${brew_prefix}/etc/dnsmasq.conf"
    local resolver_dir="/etc/resolver"
    local tld="${DOMAIN##*.}"          # e.g. "local" from "wa-analytics.local"
    local resolver_file="${resolver_dir}/${tld}"
    local marker="# whatsapp-tracker local install"

    # Add address= line to dnsmasq.conf (idempotent)
    if ! grep -qF "$DOMAIN" "$dnsmasq_conf" 2>/dev/null; then
        printf "\n%s\naddress=/%s/127.0.0.1\n" "$marker" "$DOMAIN" >> "$dnsmasq_conf"
    else
        log_skip "dnsmasq.conf entry for $DOMAIN"
    fi

    # Start / restart dnsmasq
    if brew services list | grep -q "^dnsmasq.*started"; then
        sudo brew services restart dnsmasq
    else
        sudo brew services start dnsmasq
    fi

    # /etc/resolver/<tld> — tells macOS to use 127.0.0.1 for this TLD
    if [ ! -d "$resolver_dir" ]; then
        sudo mkdir -p "$resolver_dir"
    fi
    if ! grep -q "127.0.0.1" "$resolver_file" 2>/dev/null; then
        printf "nameserver 127.0.0.1\n" | sudo tee "$resolver_file" >/dev/null
        log_ok "/etc/resolver/${tld} → nameserver 127.0.0.1"
    else
        log_skip "/etc/resolver/${tld} already configured"
    fi

    log_ok "Domain ${DOMAIN} → 127.0.0.1"
    log_info "Verify with:  dscacheutil -q host -a name ${DOMAIN}"
    log_info "Access the app at:  http://${DOMAIN}${LISTEN}"
}

_print_dns_caveat() {
    log_warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_warn "  DNS NOTICE — please read before confirming"
    log_warn "  The '.local' TLD is reserved for mDNS / Bonjour (RFC 6762)."
    log_warn "  macOS routes .local to mDNSResponder, which may intercept the"
    log_warn "  lookup before dnsmasq can answer it. Resolution may be unreliable."
    log_warn ""
    log_warn "  If you see resolution issues, re-run with a safer TLD:"
    log_warn "    --domain wa-analytics.test   (reserved for testing, no mDNS)"
    log_warn "    --domain wa-analytics.lan    (common LAN convention)"
    log_warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# ── Step: seed default admin user ────────────────────────────────────────

seed_admin_user() {
    [ -x "$APP_BIN" ] || { log_warn "Binary not found at $APP_BIN — skipping seed"; return 0; }

    local existing
    existing=$(WT_DATA_DIR="$DATA_DIR" "$APP_BIN" user list 2>/dev/null || true)
    if [ -z "$existing" ]; then
        log_info "Seeding default admin user..."
        WT_DATA_DIR="$DATA_DIR" "$APP_BIN" user add admin admin
        log_ok "Default user created — username: admin  password: admin"
        log_warn "Change the admin password after your first login!"
    else
        log_skip "Users already exist — skipping seed"
    fi
}

# ── Step: verify ──────────────────────────────────────────────────────────

os_verify() {
    local ok=0

    log_info "Checking app bundle..."
    if [ -x "$APP_BIN" ] && "$APP_BIN" --help >/dev/null 2>&1; then
        log_ok "Binary runs at $APP_BIN"
    else
        log_error "Binary not found or not executable at $APP_BIN"; ok=1
    fi

    log_info "Checking icon..."
    if [ -f "$APP_BUNDLE/Contents/Resources/tracker.icns" ]; then
        log_ok "Icon present"
    else
        log_warn "Icon not found (run without --no-icon to generate)"
    fi

    log_info "Checking LaunchAgent..."
    if launchctl print "gui/$(id -u)/${LAUNCH_LABEL}" &>/dev/null; then
        log_ok "LaunchAgent is loaded"
    else
        log_warn "LaunchAgent not loaded — check: launchctl print gui/$(id -u)/${LAUNCH_LABEL}"
    fi

    return $ok
}

# ── Uninstall ─────────────────────────────────────────────────────────────

os_uninstall() {
    log_step "Stopping and removing LaunchAgent"
    launchctl stop      "$LAUNCH_LABEL"              2>/dev/null || true
    launchctl bootout   "gui/$(id -u)/${LAUNCH_LABEL}" 2>/dev/null || true
    rm -f "$LAUNCH_PLIST"

    log_step "Removing .app bundle"
    rm -rf "$APP_BUNDLE"

    log_step "Removing CLI symlink"
    rm -f "$HOME/.local/bin/tracker"

    log_step "Removing DNS configuration"
    local brew_prefix
    brew_prefix=$(brew --prefix 2>/dev/null || echo /opt/homebrew)
    local dnsmasq_conf="${brew_prefix}/etc/dnsmasq.conf"
    local tld="${DOMAIN##*.}"
    local marker="# whatsapp-tracker local install"

    # Remove dnsmasq entry (the marker line + the address= line after it)
    if [ -f "$dnsmasq_conf" ] && grep -qF "$marker" "$dnsmasq_conf"; then
        sed -i.bak "/${marker}/{N;d;}" "$dnsmasq_conf"
        sudo brew services restart dnsmasq 2>/dev/null || true
        log_ok "dnsmasq entry removed"
    fi

    sudo rm -f "/etc/resolver/${tld}"

    log_warn "Data directory NOT removed: $DATA_DIR"
    log_warn "It contains your encryption key (.env). Remove manually when certain."
    log_ok "Uninstall complete"
}
