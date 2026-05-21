#!/usr/bin/env bash
# Sourced by install.sh / uninstall.sh — never executed directly.
# Requires REPO_ROOT exported before sourcing.

readonly GO_MIN_VERSION="1.25.6"
readonly NODE_MIN_VERSION="20.0.0"

# ── Color ──────────────────────────────────────────────────────────────────
_RED='' _GREEN='' _YELLOW='' _CYAN='' _BOLD='' _RESET=''
if [ -t 2 ] && [ -z "${NO_COLOR:-}" ]; then
    _RED='\033[0;31m' _GREEN='\033[0;32m' _YELLOW='\033[1;33m'
    _CYAN='\033[0;36m' _BOLD='\033[1m' _RESET='\033[0m'
fi

log_step()  { printf "\n${_CYAN}${_BOLD}==> %s${_RESET}\n"       "$*" >&2; }
log_info()  { printf "    ${_GREEN}%s${_RESET}\n"                 "$*" >&2; }
log_ok()    { printf "    ${_GREEN}✓ %s${_RESET}\n"               "$*" >&2; }
log_skip()  { printf "    ${_YELLOW}– %s (already done)${_RESET}\n" "$*" >&2; }
log_warn()  { printf "    ${_YELLOW}⚠  %s${_RESET}\n"             "$*" >&2; }
log_error() { printf "    ${_RED}✗ %s${_RESET}\n"                 "$*" >&2; }
die()       { log_error "$*"; exit 1; }

# ── Utilities ──────────────────────────────────────────────────────────────

have_cmd() { command -v "$1" >/dev/null 2>&1; }

# version_ge <installed> <required>  — true when installed >= required
version_ge() {
    [ "$(printf '%s\n' "$1" "$2" | sort -V | head -n1)" = "$2" ]
}

# installed_go_version — prints "0.0.0" if go is absent
installed_go_version() {
    if have_cmd go; then
        go version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1 || echo "0.0.0"
    else
        echo "0.0.0"
    fi
}

# installed_node_version — prints "0.0.0" if node is absent
installed_node_version() {
    if have_cmd node; then
        node --version 2>/dev/null | tr -d 'v' | head -n1 || echo "0.0.0"
    else
        echo "0.0.0"
    fi
}

# confirm <prompt>  — returns 0=yes, 1=no; honors ASSUME_YES=1
confirm() {
    if [ "${ASSUME_YES:-0}" = "1" ]; then return 0; fi
    local ans
    printf "${_BOLD}%s [y/N] ${_RESET}" "$1" >&2
    read -r ans
    case "$ans" in [yY]*) return 0 ;; *) return 1 ;; esac
}

detect_os() {
    case "$(uname -s 2>/dev/null)" in
        Linux*)  echo "linux" ;;
        Darwin*) echo "macos" ;;
        *)       echo "unsupported" ;;
    esac
}

ensure_dir() { mkdir -p "$1" && chmod "${2:-755}" "$1"; }

# idempotent hosts-file entry: append "127.0.0.1 <domain>" if not present
ensure_hosts_entry() {
    local domain="$1"
    local marker="# whatsapp-tracker local install"
    if grep -qF "$domain" /etc/hosts 2>/dev/null; then
        log_skip "hosts entry for $domain already present"
        return 0
    fi
    echo "127.0.0.1 ${domain}    ${marker}" | sudo tee -a /etc/hosts >/dev/null
    log_ok "Added 127.0.0.1 $domain to /etc/hosts"
}

# remove our hosts-file entry
remove_hosts_entry() {
    local marker="# whatsapp-tracker local install"
    if ! grep -qF "$marker" /etc/hosts 2>/dev/null; then return 0; fi
    sudo sed -i.bak "/${marker}/d" /etc/hosts
    log_ok "Removed hosts entry"
}
