#!/usr/bin/env bash
# uninstall.sh — remove the local WA Analytics installation (Linux + macOS).
# This does NOT remove the data directory (~/.local/share/whatsapp-tracker)
# because it contains your encryption key (.env) — remove it manually.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ASSUME_YES=0
DOMAIN="wa-analytics.local"
DATA_DIR="${WT_DATA_DIR:-$HOME/.local/share/whatsapp-tracker}"
EMBED_ICON=1

while [[ $# -gt 0 ]]; do
    case "$1" in
        --yes)     ASSUME_YES=1 ;;
        --domain)  DOMAIN="$2"; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

export ASSUME_YES REPO_ROOT DOMAIN DATA_DIR EMBED_ICON

# shellcheck source=lib/common.sh
source "$SCRIPT_DIR/lib/common.sh"

OS=$(detect_os)
case "$OS" in
    linux) source "$SCRIPT_DIR/lib/linux.sh" ;;
    macos) source "$SCRIPT_DIR/lib/macos.sh" ;;
    *)     die "Unsupported OS: $(uname -s)" ;;
esac

printf "\n${_BOLD}WA Analytics — Uninstall${_RESET}\n\n"
confirm "Remove WA Analytics local installation?" || { echo "Aborted."; exit 0; }

os_uninstall
