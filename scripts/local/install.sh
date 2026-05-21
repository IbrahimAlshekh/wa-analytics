#!/usr/bin/env bash
# install.sh — local single-machine installer for WA Analytics (Linux + macOS).
#
# Usage:
#   ./scripts/local/install.sh [options]
#
# Options:
#   --yes            Non-interactive; answer yes to all prompts
#   --skip-deps      Skip build-dependency installation
#   --skip-build     Skip project build (use existing bin/tracker)
#   --skip-service   Skip background service installation
#   --skip-dns       Skip dnsmasq / DNS configuration
#   --no-icon        Skip native OS icon embedding
#   --listen ADDR    HTTP listen address (default: :8080)
#   --domain DOMAIN  Local domain to map (default: wa-analytics.local)
#   --uninstall      Run the uninstaller instead
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# ── Defaults ───────────────────────────────────────────────────────────────
ASSUME_YES=0
SKIP_DEPS=0
SKIP_BUILD=0
SKIP_SERVICE=0
SKIP_DNS=0
EMBED_ICON=1
LISTEN=":8080"
DOMAIN="wa-analytics.local"
DATA_DIR="${WT_DATA_DIR:-$HOME/.local/share/whatsapp-tracker}"
DO_UNINSTALL=0

# ── Flag parsing ───────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --yes)           ASSUME_YES=1 ;;
        --skip-deps)     SKIP_DEPS=1 ;;
        --skip-build)    SKIP_BUILD=1 ;;
        --skip-service)  SKIP_SERVICE=1 ;;
        --skip-dns)      SKIP_DNS=1 ;;
        --no-icon)       EMBED_ICON=0 ;;
        --listen)        LISTEN="$2"; shift ;;
        --domain)        DOMAIN="$2"; shift ;;
        --uninstall)     DO_UNINSTALL=1 ;;
        -h|--help)
            sed -n '/^# Usage:/,/^set -/p' "$0" | grep '^#' | sed 's/^# \?//'
            exit 0 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

export ASSUME_YES REPO_ROOT LISTEN DOMAIN DATA_DIR EMBED_ICON FIRST_SUDO=0

# ── Source shared helpers ──────────────────────────────────────────────────
# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

# ── OS detection + source OS module ───────────────────────────────────────
OS=$(detect_os)
case "$OS" in
    linux)
        # shellcheck source=lib/linux.sh
        source "$SCRIPT_DIR/lib/linux.sh"
        ;;
    macos)
        # shellcheck source=lib/macos.sh
        source "$SCRIPT_DIR/lib/macos.sh"
        ;;
    *)
        die "Unsupported OS: $(uname -s). Use install.ps1 on Windows."
        ;;
esac

# ── Uninstall path ─────────────────────────────────────────────────────────
if [ "$DO_UNINSTALL" = "1" ]; then
    log_step "Uninstalling WA Analytics"
    os_uninstall
    exit 0
fi

# ── Banner ─────────────────────────────────────────────────────────────────
printf "\n${_BOLD}WA Analytics — Local Install${_RESET}\n"
printf "  OS:       %s\n" "$OS"
printf "  Listen:   %s\n" "$LISTEN"
printf "  Domain:   %s\n" "$DOMAIN"
printf "  Data dir: %s\n" "$DATA_DIR"
printf "\n"

# ── Install steps ──────────────────────────────────────────────────────────

if [ "$SKIP_DEPS" = "0" ]; then
    log_step "Installing build dependencies"
    os_install_build_deps
fi

if [ "$SKIP_BUILD" = "0" ]; then
    log_step "Building the project"
    build_project
fi

log_step "Installing binary"
os_install_binary

if [ "$EMBED_ICON" = "1" ]; then
    log_step "Setting up native OS icon"
    os_embed_icon
fi

if [ "$SKIP_SERVICE" = "0" ]; then
    log_step "Installing background service"
    os_install_service
fi

if [ "$SKIP_DNS" = "0" ]; then
    log_step "Configuring DNS"
    os_configure_dns
fi

log_step "Verifying installation"
os_verify

# ── Summary ────────────────────────────────────────────────────────────────
printf "\n${_GREEN}${_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${_RESET}\n"
printf "${_GREEN}${_BOLD}  WA Analytics is installed and running!${_RESET}\n\n"
printf "  App URL:    ${_BOLD}http://localhost%s${_RESET}\n" "$LISTEN"
if [ "$SKIP_DNS" = "0" ]; then
printf "  Domain URL: ${_BOLD}http://%s%s${_RESET}\n" "$DOMAIN" "$LISTEN"
fi
printf "  Data dir:   %s\n" "$DATA_DIR"
printf "\n"
printf "  ${_BOLD}First-run checklist:${_RESET}\n"
printf "  1. Add your first user:  tracker user add <username>\n"
printf "  2. Back up your app key: cat %s/.env\n" "$DATA_DIR"
printf "     Losing this file means encrypted data CANNOT be recovered.\n"
printf "\n"
if [ "$OS" = "linux" ]; then
printf "  Service commands:\n"
printf "    systemctl --user status whatsapp-tracker\n"
printf "    journalctl --user -u whatsapp-tracker -f\n"
elif [ "$OS" = "macos" ]; then
printf "  Service commands:\n"
printf "    launchctl print gui/\$(id -u)/com.whatsapptracker.tracker\n"
printf "    tail -f %s/tracker.log\n" "$DATA_DIR"
fi
printf "${_GREEN}${_BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${_RESET}\n\n"
