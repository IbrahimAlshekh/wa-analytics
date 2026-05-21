#!/usr/bin/env bash
# linux.sh — Linux-specific install functions.
# Sourced by install.sh after common.sh. Requires REPO_ROOT, LISTEN, DOMAIN, DATA_DIR, EMBED_ICON.

# ── Package manager detection ──────────────────────────────────────────────

_detect_pkg_manager() {
    if have_cmd apt-get;  then echo "apt"
    elif have_cmd dnf;    then echo "dnf"
    elif have_cmd pacman; then echo "pacman"
    else echo "unknown"
    fi
}

_pkg_install() {
    local pm
    pm=$(_detect_pkg_manager)
    case "$pm" in
        apt)    sudo apt-get install -y "$@" ;;
        dnf)    sudo dnf install -y "$@" ;;
        pacman) sudo pacman -S --noconfirm "$@" ;;
        *) die "Unsupported package manager. Install these manually: $*" ;;
    esac
}

# Map generic package names to distro-specific names
_pkg_name() {
    local pm
    pm=$(_detect_pkg_manager)
    case "$1" in
        build-essential)
            case "$pm" in
                apt)    echo "build-essential" ;;
                dnf)    echo "gcc make" ;;
                pacman) echo "base-devel" ;;
            esac ;;
        *) echo "$1" ;;
    esac
}

# ── Step: install build dependencies ──────────────────────────────────────

os_install_build_deps() {
    local pm
    pm=$(_detect_pkg_manager)
    log_info "Package manager: $pm"

    # ---- C compiler (required for CGO / go-sqlite3) ----
    if have_cmd gcc && have_cmd make; then
        log_skip "C toolchain (gcc + make)"
    else
        log_info "Installing C toolchain (required for CGO)..."
        if [ "${FIRST_SUDO:-0}" = "0" ]; then
            log_warn "The next step requires sudo to install system packages (gcc, make)."
            confirm "Proceed with sudo install?" || die "Aborted."
            FIRST_SUDO=1
        fi
        # shellcheck disable=SC2046
        _pkg_install $(_pkg_name build-essential)
        log_ok "C toolchain installed"
    fi

    # ---- git / curl ----
    for tool in git curl; do
        if have_cmd "$tool"; then
            log_skip "$tool"
        else
            _pkg_install "$tool"
            log_ok "$tool installed"
        fi
    done

    # ---- Go ----
    local go_have
    go_have=$(installed_go_version)
    if version_ge "$go_have" "$GO_MIN_VERSION"; then
        log_skip "Go $go_have (>= $GO_MIN_VERSION required)"
    else
        log_info "Installing Go ${GO_MIN_VERSION}..."
        _install_go_tarball
        log_ok "Go ${GO_MIN_VERSION} installed to ~/.local/go"
        log_warn "Add to your shell profile (~/.bashrc or ~/.zshrc):"
        log_warn "  export PATH=\"\$HOME/.local/go/bin:\$PATH\""
    fi

    # ---- Node ----
    local node_have
    node_have=$(installed_node_version)
    if version_ge "$node_have" "$NODE_MIN_VERSION"; then
        log_skip "Node $node_have (>= $NODE_MIN_VERSION required)"
    else
        log_info "Installing Node.js 20..."
        case "$pm" in
            apt)
                curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
                sudo apt-get install -y nodejs
                ;;
            dnf)
                sudo dnf module install -y nodejs:20
                ;;
            pacman)
                sudo pacman -S --noconfirm nodejs npm
                ;;
            *) die "Install Node.js 20+ manually then re-run." ;;
        esac
        log_ok "Node.js installed"
    fi

    # ---- pnpm ----
    if have_cmd pnpm; then
        log_skip "pnpm"
    else
        log_info "Installing pnpm via corepack..."
        if have_cmd corepack; then
            sudo corepack enable pnpm
        else
            sudo npm install -g pnpm
        fi
        log_ok "pnpm installed"
    fi
}

_install_go_tarball() {
    local arch
    arch=$(uname -m)
    case "$arch" in
        x86_64)  arch="amd64" ;;
        aarch64) arch="arm64" ;;
        *) die "Unsupported CPU architecture for Go tarball: $arch" ;;
    esac

    local tarball="go${GO_MIN_VERSION}.linux-${arch}.tar.gz"
    local url="https://go.dev/dl/${tarball}"
    local tmp
    tmp=$(mktemp -d)

    log_info "Downloading $url..."
    curl -fsSL -o "${tmp}/${tarball}" "${url}" || die "Failed to download Go tarball"

    rm -rf "$HOME/.local/go"
    mkdir -p "$HOME/.local"
    tar -C "$HOME/.local" -xzf "${tmp}/${tarball}"
    rm -rf "${tmp}"

    export PATH="$HOME/.local/go/bin:$PATH"
}

# ── Step: build the project ────────────────────────────────────────────────

build_project() {
    log_info "Building web + Go binary..."
    cd "$REPO_ROOT"
    make build
    log_ok "Binary built at bin/tracker"
}

# ── Step: install the binary ───────────────────────────────────────────────

os_install_binary() {
    local dest="$HOME/.local/bin/tracker"
    ensure_dir "$HOME/.local/bin"
    install -m 755 "$REPO_ROOT/bin/tracker" "$dest"
    log_ok "Binary installed → $dest"

    # Warn if not on PATH
    if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
        log_warn "~/.local/bin is not in your PATH."
        log_warn "Add to your shell profile:  export PATH=\"\$HOME/.local/bin:\$PATH\""
    fi
}

# ── Step: native OS icon (.desktop + icon) ────────────────────────────────

os_embed_icon() {
    if [ "${EMBED_ICON:-1}" = "0" ]; then
        log_skip "OS icon (--no-icon)"
        return 0
    fi

    local icon_src="$REPO_ROOT/web/src/assets/wa_analytics_logo_512.png"
    local icon_dir="$HOME/.local/share/icons/hicolor/512x512/apps"
    local icon_dest="$icon_dir/whatsapp-tracker.png"
    local desktop_dir="$HOME/.local/share/applications"
    local desktop_dest="$desktop_dir/whatsapp-tracker.desktop"
    local tmpl="$REPO_ROOT/scripts/local/assets/whatsapp-tracker.desktop.tmpl"
    local bin_path="$HOME/.local/bin/tracker"

    [ -f "$icon_src" ] || { log_warn "Logo not found at $icon_src — skipping icon"; return 0; }

    ensure_dir "$icon_dir"
    ensure_dir "$desktop_dir"

    cp "$icon_src" "$icon_dest"

    sed \
        -e "s|@BIN_PATH@|${bin_path}|g" \
        -e "s|@LISTEN@|${LISTEN}|g" \
        "$tmpl" > "$desktop_dest"
    chmod 644 "$desktop_dest"

    # Refresh caches if available
    have_cmd update-desktop-database && update-desktop-database "$desktop_dir" 2>/dev/null || true
    have_cmd gtk-update-icon-cache   && gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

    log_ok "Icon installed → $icon_dest"
    log_ok ".desktop entry → $desktop_dest"
}

# ── Step: systemd user service ────────────────────────────────────────────

os_install_service() {
    local unit_dir="$HOME/.config/systemd/user"
    local unit_file="$unit_dir/whatsapp-tracker.service"
    local tmpl="$REPO_ROOT/scripts/local/assets/whatsapp-tracker.service.tmpl"
    local bin_path="$HOME/.local/bin/tracker"

    ensure_dir "$unit_dir"
    ensure_dir "$DATA_DIR" "700"

    sed \
        -e "s|@BIN_PATH@|${bin_path}|g" \
        -e "s|@LISTEN@|${LISTEN}|g" \
        -e "s|@DATA_DIR@|${DATA_DIR}|g" \
        "$tmpl" > "$unit_file"

    systemctl --user daemon-reload
    systemctl --user enable --now whatsapp-tracker

    log_ok "Service installed and started"
    log_info "  Status:  systemctl --user status whatsapp-tracker"
    log_info "  Logs:    journalctl --user -u whatsapp-tracker -f"

    # Offer linger (survive logout / start at boot)
    log_info ""
    log_info "Enable 'linger' so the service starts at boot and survives logout?"
    if confirm "Run: loginctl enable-linger $USER"; then
        loginctl enable-linger "$USER"
        log_ok "Linger enabled for $USER"
    else
        log_warn "Skipped. Service will only run while you're logged in."
        log_warn "Run 'loginctl enable-linger $USER' manually to change this."
    fi
}

# ── Step: dnsmasq + wa-analytics.local ────────────────────────────────────

os_configure_dns() {
    _print_dns_caveat

    if ! confirm "Map ${DOMAIN} → 127.0.0.1 on this machine?"; then
        log_skip "DNS configuration"
        log_info "You can still reach the app at http://localhost${LISTEN}"
        return 0
    fi

    # Install dnsmasq if missing
    if ! have_cmd dnsmasq; then
        log_info "Installing dnsmasq..."
        _pkg_install dnsmasq
    else
        log_skip "dnsmasq already installed"
    fi

    _configure_dnsmasq_linux

    log_ok "Domain ${DOMAIN} → 127.0.0.1"
    log_info "Verify with:  getent hosts ${DOMAIN}"
    log_info "Access the app at:  http://${DOMAIN}${LISTEN}"
}

_print_dns_caveat() {
    log_warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    log_warn "  DNS NOTICE — please read before confirming"
    log_warn "  The '.local' TLD (e.g. wa-analytics.local) is reserved for"
    log_warn "  mDNS / Avahi (RFC 6762). On desktops with Avahi running,"
    log_warn "  .local lookups may be intercepted by mDNS and NOT reach"
    log_warn "  dnsmasq, causing resolution failures."
    log_warn ""
    log_warn "  If you see resolution issues, re-run with a different domain:"
    log_warn "    --domain wa-analytics.test   (reserved for testing, no mDNS)"
    log_warn "    --domain wa-analytics.lan    (common LAN convention)"
    log_warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

_configure_dnsmasq_linux() {
    local conf_entry="address=/${DOMAIN}/127.0.0.1"
    local marker="# whatsapp-tracker local install"

    # NetworkManager-managed dnsmasq?
    if systemctl is-active --quiet NetworkManager 2>/dev/null && \
       grep -qE '^dns\s*=\s*dnsmasq' /etc/NetworkManager/NetworkManager.conf 2>/dev/null; then
        local nm_conf="/etc/NetworkManager/dnsmasq.d/wa-analytics.conf"
        if ! sudo test -f "$nm_conf" || ! sudo grep -qF "$DOMAIN" "$nm_conf" 2>/dev/null; then
            printf "%s\n%s\n" "$marker" "$conf_entry" | sudo tee "$nm_conf" >/dev/null
            sudo systemctl reload NetworkManager
            log_ok "Configured via NetworkManager dnsmasq.d"
        else
            log_skip "NetworkManager dnsmasq entry for $DOMAIN"
        fi
        return 0
    fi

    # Standalone dnsmasq
    local conf_dir="/etc/dnsmasq.d"
    local conf_file="${conf_dir}/wa-analytics.conf"
    if sudo test -d "$conf_dir" 2>/dev/null; then
        if ! sudo test -f "$conf_file" 2>/dev/null || ! sudo grep -qF "$DOMAIN" "$conf_file" 2>/dev/null; then
            printf "%s\n%s\n" "$marker" "$conf_entry" | sudo tee "$conf_file" >/dev/null
        else
            log_skip "dnsmasq.d entry for $DOMAIN"
        fi
    else
        # Append to /etc/dnsmasq.conf
        local main_conf="/etc/dnsmasq.conf"
        if ! sudo grep -qF "$DOMAIN" "$main_conf" 2>/dev/null; then
            printf "\n%s\n%s\n" "$marker" "$conf_entry" | sudo tee -a "$main_conf" >/dev/null
        else
            log_skip "dnsmasq.conf entry for $DOMAIN"
        fi
    fi

    # Restart dnsmasq
    if systemctl is-active --quiet dnsmasq 2>/dev/null; then
        sudo systemctl restart dnsmasq
    else
        sudo systemctl enable --now dnsmasq
    fi
}

# ── Step: seed default admin user ────────────────────────────────────────

seed_admin_user() {
    local bin="$HOME/.local/bin/tracker"
    [ -x "$bin" ] || { log_warn "Binary not found at $bin — skipping seed"; return 0; }

    local existing
    existing=$(WT_DATA_DIR="$DATA_DIR" "$bin" user list 2>/dev/null || true)
    if [ -z "$existing" ]; then
        log_info "Seeding default admin user..."
        WT_DATA_DIR="$DATA_DIR" "$bin" user add admin admin
        log_ok "Default user created — username: admin  password: admin"
        log_warn "Change the admin password after your first login!"
    else
        log_skip "Users already exist — skipping seed"
    fi
}

# ── Step: verify ──────────────────────────────────────────────────────────

os_verify() {
    local bin="$HOME/.local/bin/tracker"
    local ok=0

    log_info "Checking binary..."
    if [ -x "$bin" ] && "$bin" --help >/dev/null 2>&1; then
        log_ok "Binary runs at $bin"
    else
        log_error "Binary not found or not executable at $bin"; ok=1
    fi

    log_info "Checking service..."
    if systemctl --user is-active --quiet whatsapp-tracker 2>/dev/null; then
        log_ok "Service is active"
    else
        log_warn "Service not active — check: systemctl --user status whatsapp-tracker"
    fi

    return $ok
}

# ── Uninstall ─────────────────────────────────────────────────────────────

os_uninstall() {
    log_step "Stopping and removing service"
    systemctl --user stop    whatsapp-tracker 2>/dev/null || true
    systemctl --user disable whatsapp-tracker 2>/dev/null || true
    rm -f "$HOME/.config/systemd/user/whatsapp-tracker.service"
    systemctl --user daemon-reload 2>/dev/null || true

    log_step "Removing binary"
    rm -f "$HOME/.local/bin/tracker"

    log_step "Removing icon and .desktop entry"
    rm -f "$HOME/.local/share/icons/hicolor/512x512/apps/whatsapp-tracker.png"
    rm -f "$HOME/.local/share/applications/whatsapp-tracker.desktop"
    have_cmd update-desktop-database && update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

    log_step "Removing DNS configuration"
    sudo rm -f /etc/dnsmasq.d/wa-analytics.conf
    sudo rm -f /etc/NetworkManager/dnsmasq.d/wa-analytics.conf
    if have_cmd dnsmasq && systemctl is-active --quiet dnsmasq 2>/dev/null; then
        sudo systemctl restart dnsmasq
    fi

    log_warn "Data directory NOT removed: $DATA_DIR"
    log_warn "It contains your encryption key (.env). Remove manually when certain."
    log_ok "Uninstall complete"
}
