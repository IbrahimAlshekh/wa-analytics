#requires -Version 5.1
<#
.SYNOPSIS
    Local single-machine installer for WA Analytics (Windows).

.DESCRIPTION
    Installs build dependencies, builds the project, installs the binary,
    embeds a native .exe icon, registers a background service, and maps
    wa-analytics.local to localhost.

.PARAMETER AssumeYes
    Non-interactive; answer yes to all prompts.

.PARAMETER SkipDeps
    Skip build-dependency installation.

.PARAMETER SkipBuild
    Skip project build (use existing bin\tracker.exe).

.PARAMETER SkipService
    Skip background service installation.

.PARAMETER SkipDns
    Skip hosts-file DNS configuration.

.PARAMETER NoIcon
    Skip native .exe icon embedding.

.PARAMETER Listen
    HTTP listen address (default: :8080).

.PARAMETER Domain
    Local domain to map (default: wa-analytics.local).

.PARAMETER Uninstall
    Run the uninstaller instead.

.EXAMPLE
    .\scripts\local\install.ps1
    .\scripts\local\install.ps1 -AssumeYes -Listen ":9090" -Domain "wa-analytics.test"
    .\scripts\local\install.ps1 -Uninstall
#>
param(
    [switch]$AssumeYes,
    [switch]$SkipDeps,
    [switch]$SkipBuild,
    [switch]$SkipService,
    [switch]$SkipDns,
    [switch]$NoIcon,
    [string]$Listen   = ":8080",
    [string]$Domain   = "wa-analytics.local",
    [switch]$Uninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = (Resolve-Path (Join-Path $scriptDir "..\..")).Path

# Dot-source shared helpers
. (Join-Path $scriptDir "lib-win\common.ps1")
. (Join-Path $scriptDir "lib-win\windows.ps1")

# Propagate flags to module scope
$script:ASSUME_YES = $AssumeYes.IsPresent
$script:REPO_ROOT  = $repoRoot
$script:LISTEN     = $Listen
$script:DOMAIN     = $Domain
$script:DATA_DIR   = if ($env:WT_DATA_DIR) { $env:WT_DATA_DIR } else { Join-Path $env:LOCALAPPDATA "whatsapp-tracker" }
$script:EMBED_ICON = -not $NoIcon.IsPresent

# ── Uninstall path ─────────────────────────────────────────────────────────
if ($Uninstall) {
    Write-Step "Uninstalling WA Analytics"
    Win-Uninstall
    exit 0
}

# ── Banner ─────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "WA Analytics — Local Install (Windows)" -ForegroundColor Cyan -BackgroundColor Black
Write-Host "  Listen:   $Listen"
Write-Host "  Domain:   $Domain  (hosts file)"
Write-Host "  Data dir: $($script:DATA_DIR)"
Write-Host ""

# ── Install steps ──────────────────────────────────────────────────────────

if (-not $SkipDeps) {
    Write-Step "Installing build dependencies"
    Win-InstallBuildDeps
}

if (-not $SkipBuild) {
    Write-Step "Building the project"
    Win-BuildProject
}

Write-Step "Installing binary"
Win-InstallBinary

if (-not $SkipService) {
    Write-Step "Installing background service"
    Win-InstallService
}

if (-not $SkipDns) {
    Write-Step "Configuring DNS (hosts file)"
    Win-ConfigureDns
}

Write-Step "Verifying installation"
Win-Verify

# ── Summary ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host "  WA Analytics is installed and running!" -ForegroundColor Green
Write-Host ""
Write-Host "  App URL:    http://localhost$Listen" -ForegroundColor White
if (-not $SkipDns) {
Write-Host "  Domain URL: http://$Domain$Listen" -ForegroundColor White
}
Write-Host "  Data dir:   $($script:DATA_DIR)"
Write-Host ""
Write-Host "  First-run checklist:" -ForegroundColor Yellow
Write-Host "  1. Add your first user:  tracker user add <username>"
Write-Host "  2. Back up your app key: cat $($script:DATA_DIR)\.env"
Write-Host "     Losing this file means encrypted data CANNOT be recovered."
Write-Host ""
Write-Host "  Service commands:"
Write-Host "    Get-Service $SERVICE_NAME"
Write-Host "    nssm stop $SERVICE_NAME  /  nssm start $SERVICE_NAME"
Write-Host "    Logs: $($script:DATA_DIR)\tracker.log"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
Write-Host ""
