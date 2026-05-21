# common.ps1 — shared PowerShell helpers; dot-sourced, never run directly.

$GO_MIN_VERSION   = [version]"1.25.6"
$NODE_MIN_VERSION = [version]"20.0.0"

# ── Color / logging ────────────────────────────────────────────────────────

function Write-Step  { param([string]$Msg) Write-Host "`n==> $Msg" -ForegroundColor Cyan }
function Write-Info  { param([string]$Msg) Write-Host "    $Msg"   -ForegroundColor Green }
function Write-Ok    { param([string]$Msg) Write-Host "    v $Msg"  -ForegroundColor Green }
function Write-Skip  { param([string]$Msg) Write-Host "    - $Msg (already done)" -ForegroundColor Yellow }
function Write-Warn  { param([string]$Msg) Write-Host "    ! $Msg"  -ForegroundColor Yellow }
function Write-ErrMsg{ param([string]$Msg) Write-Host "    x $Msg"  -ForegroundColor Red }
function Exit-Error  { param([string]$Msg) Write-ErrMsg $Msg; exit 1 }

# ── Utilities ─────────────────────────────────────────────────────────────

function Test-HaveCmd {
    param([string]$Name)
    $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

function Get-InstalledVersion {
    param([string]$Cmd, [string]$VersionArg = "--version")
    if (-not (Test-HaveCmd $Cmd)) { return [version]"0.0.0" }
    try {
        $raw = & $Cmd $VersionArg 2>&1 | Select-Object -First 1
        $match = [regex]::Match($raw, '\d+\.\d+(\.\d+)?')
        if ($match.Success) { return [version]$match.Value }
    } catch {}
    return [version]"0.0.0"
}

function Test-VersionGe {
    param([version]$Installed, [version]$Required)
    $Installed -ge $Required
}

function Confirm-Action {
    param([string]$Prompt, [switch]$AssumeYes)
    if ($AssumeYes -or $script:ASSUME_YES) { return $true }
    $choice = $Host.UI.PromptForChoice("", $Prompt, @("&Yes", "&No"), 1)
    return $choice -eq 0
}

function Test-IsAdmin {
    $current = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($current)
    $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-RepoRoot {
    # install.ps1 is at scripts\local\install.ps1 → two levels up = repo root
    $scriptDir = Split-Path -Parent $PSCommandPath
    return (Resolve-Path (Join-Path $scriptDir "..\..")).Path
}

function Ensure-Dir {
    param([string]$Path)
    if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Force -Path $Path | Out-Null }
}

# Idempotent hosts-file entry
function Ensure-HostsEntry {
    param([string]$Domain)
    $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
    $marker    = "# whatsapp-tracker local install"
    $content   = Get-Content $hostsPath -ErrorAction SilentlyContinue
    if ($content -match [regex]::Escape($Domain)) {
        Write-Skip "hosts entry for $Domain"
        return
    }
    Add-Content -Path $hostsPath -Value "127.0.0.1  $Domain    $marker"
    Write-Ok "Added 127.0.0.1 $Domain to hosts"
}

function Remove-HostsEntry {
    $hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
    $marker    = "# whatsapp-tracker local install"
    $lines     = Get-Content $hostsPath -ErrorAction SilentlyContinue
    if (-not $lines) { return }
    $filtered  = $lines | Where-Object { $_ -notmatch [regex]::Escape($marker) }
    Set-Content -Path $hostsPath -Value $filtered
    Write-Ok "Removed hosts entry"
}
