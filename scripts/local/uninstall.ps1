#requires -Version 5.1
<#
.SYNOPSIS
    Remove the local WA Analytics installation (Windows).

.DESCRIPTION
    Stops and removes the service, removes the binary and install directory,
    and cleans up the hosts-file entry.
    Does NOT remove the data directory — it contains your encryption key.

.PARAMETER AssumeYes
    Skip confirmation prompt.

.PARAMETER Domain
    The domain that was configured (default: wa-analytics.local).
#>
param(
    [switch]$AssumeYes,
    [string]$Domain = "wa-analytics.local"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = (Resolve-Path (Join-Path $scriptDir "..\..")).Path

. (Join-Path $scriptDir "lib-win\common.ps1")
. (Join-Path $scriptDir "lib-win\windows.ps1")

$script:ASSUME_YES = $AssumeYes.IsPresent
$script:REPO_ROOT  = $repoRoot
$script:DOMAIN     = $Domain
$script:DATA_DIR   = if ($env:WT_DATA_DIR) { $env:WT_DATA_DIR } else { Join-Path $env:LOCALAPPDATA "whatsapp-tracker" }

Write-Host ""
Write-Host "WA Analytics — Uninstall" -ForegroundColor Cyan
Write-Host ""

if (-not (Confirm-Action "Remove WA Analytics local installation?" -AssumeYes:$AssumeYes)) {
    Write-Host "Aborted."
    exit 0
}

Win-Uninstall
