# windows.ps1 — Windows-specific install functions.
# Dot-sourced by install.ps1 after common.ps1.
# Requires: $script:REPO_ROOT, $script:LISTEN, $script:DOMAIN, $script:DATA_DIR, $script:EMBED_ICON

$INSTALL_DIR  = Join-Path $env:LOCALAPPDATA "WhatsApp Tracker"
$BIN_DEST     = Join-Path $INSTALL_DIR "tracker.exe"
$SERVICE_NAME = "WhatsAppTracker"

# ── Package manager ────────────────────────────────────────────────────────

function Get-PackageManager {
    if (Test-HaveCmd "winget") { return "winget" }
    if (Test-HaveCmd "choco")  { return "choco" }
    return $null
}

function Install-WithPM {
    param([string]$WingetId, [string]$ChocoId)
    $pm = Get-PackageManager
    if ($pm -eq "winget") {
        winget install --id $WingetId --accept-source-agreements --accept-package-agreements -e
    } elseif ($pm -eq "choco") {
        choco install $ChocoId -y
    } else {
        Exit-Error "No package manager found (winget or chocolatey). Install manually."
    }
}

# ── Step: install build dependencies ──────────────────────────────────────

function Win-InstallBuildDeps {
    # ---- Package manager ----
    $pm = Get-PackageManager
    if (-not $pm) {
        Write-Warn "No package manager found. Installing Chocolatey..."
        if (Confirm-Action "Install Chocolatey?" -AssumeYes:$script:ASSUME_YES) {
            Set-ExecutionPolicy Bypass -Scope Process -Force
            [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
            Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            Write-Ok "Chocolatey installed"
        } else {
            Exit-Error "A package manager (winget or chocolatey) is required."
        }
    } else {
        Write-Skip "Package manager ($pm)"
    }

    # ---- MSYS2 / GCC (required for CGO / mattn/go-sqlite3) ----
    $gccPath = "C:\msys64\ucrt64\bin\gcc.exe"
    if (Test-Path $gccPath) {
        Write-Skip "MSYS2 gcc"
        $env:CC  = $gccPath
        $env:Path = "C:\msys64\ucrt64\bin;" + $env:Path
    } else {
        Write-Info "Installing MSYS2 (C compiler required for CGO)..."
        Install-WithPM "MSYS2.MSYS2" "msys2"
        # Run initial MSYS2 setup to install ucrt64 gcc
        Write-Info "Installing ucrt64 GCC toolchain inside MSYS2..."
        & "C:\msys64\usr\bin\bash.exe" -lc "pacman -Sy --noconfirm mingw-w64-ucrt-x86_64-gcc mingw-w64-ucrt-x86_64-make" 2>&1 | ForEach-Object { Write-Host "    $_" }
        $env:CC  = $gccPath
        $env:Path = "C:\msys64\ucrt64\bin;" + $env:Path
        Write-Ok "MSYS2 + ucrt64 gcc installed"
        Write-Warn "Add to your user PATH permanently:  C:\msys64\ucrt64\bin"
    }

    # ---- Go ----
    $goVer = Get-InstalledVersion "go" "version"
    if (Test-VersionGe $goVer $GO_MIN_VERSION) {
        Write-Skip "Go $goVer (>= $GO_MIN_VERSION required)"
    } else {
        Write-Info "Installing Go $GO_MIN_VERSION..."
        Install-WithPM "GoLang.Go" "golang"
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + $env:Path
        Write-Ok "Go installed"
    }

    # ---- Node ----
    $nodeVer = Get-InstalledVersion "node" "--version"
    if (Test-VersionGe $nodeVer $NODE_MIN_VERSION) {
        Write-Skip "Node $nodeVer (>= $NODE_MIN_VERSION required)"
    } else {
        Write-Info "Installing Node.js LTS..."
        Install-WithPM "OpenJS.NodeJS.LTS" "nodejs-lts"
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + $env:Path
        Write-Ok "Node.js installed"
    }

    # ---- pnpm ----
    if (Test-HaveCmd "pnpm") {
        Write-Skip "pnpm"
    } else {
        Write-Info "Installing pnpm via corepack..."
        if (Test-HaveCmd "corepack") {
            corepack enable pnpm
        } else {
            npm install -g pnpm
        }
        Write-Ok "pnpm installed"
    }
}

# ── Step: build the project (replicate Makefile targets in PowerShell) ────

function Win-BuildProject {
    Write-Info "Building web assets..."
    Push-Location (Join-Path $script:REPO_ROOT "web")
    try {
        # pnpm v11 two-pass workaround (mirrors Makefile web-build target)
        pnpm install --no-frozen-lockfile 2>&1 | Out-Null
        pnpm approve-builds esbuild        2>&1 | Out-Null
        pnpm install --no-frozen-lockfile
        pnpm build
    } finally {
        Pop-Location
    }

    # Embed icon .syso before go build (Windows only; named *_windows_amd64.syso so POSIX builds ignore it)
    if (-not $script:EMBED_ICON) {
        Write-Info "Skipping icon embedding (--no-icon)"
    } else {
        Win-GenerateIconSyso
    }

    Write-Info "Building Go binary..."
    Push-Location $script:REPO_ROOT
    try {
        $env:CGO_ENABLED = "1"
        go build -o "bin\tracker.exe" ".\cmd\tracker"
    } finally {
        Pop-Location
    }
    Write-Ok "Binary built at bin\tracker.exe"
}

function Win-GenerateIconSyso {
    $iconSrc = Join-Path $script:REPO_ROOT "web\src\assets\favicon.ico"
    if (-not (Test-Path $iconSrc)) {
        Write-Warn "favicon.ico not found at $iconSrc — skipping .exe icon"
        return
    }

    # Install goversioninfo if missing
    if (-not (Test-HaveCmd "goversioninfo")) {
        Write-Info "Installing goversioninfo..."
        go install "github.com/josephspurrier/goversioninfo/cmd/goversioninfo@latest"
        $goBin = Join-Path (go env GOPATH) "bin"
        $env:Path = "$goBin;$env:Path"
    }

    $assetDir    = Join-Path $script:REPO_ROOT "scripts\local\assets"
    $icoDestDir  = $assetDir
    $icoFile     = Join-Path $icoDestDir "tracker.ico"
    $sysoOut     = Join-Path $script:REPO_ROOT "cmd\tracker\resource_windows_amd64.syso"

    # Prefer PNG source for better multi-res icon if ImageMagick is available
    $pngSrc = Join-Path $script:REPO_ROOT "web\src\assets\wa_analytics_logo_512.png"
    if ((Test-HaveCmd "magick") -and (Test-Path $pngSrc)) {
        Write-Info "Generating multi-resolution .ico from PNG..."
        magick convert $pngSrc -define "icon:auto-resize=256,128,64,48,32,16" $icoFile
    } else {
        Copy-Item $iconSrc $icoFile -Force
    }

    # Patch versioninfo.json IconPath to absolute path for goversioninfo
    $vjsonSrc    = Join-Path $assetDir "versioninfo.json"
    $vjsonTmp    = Join-Path $env:TEMP "versioninfo_tmp.json"
    $vjsonContent = Get-Content $vjsonSrc -Raw | ConvertFrom-Json
    $vjsonContent.IconPath = $icoFile.Replace("\", "/")
    $vjsonContent | ConvertTo-Json -Depth 10 | Set-Content $vjsonTmp

    Push-Location $script:REPO_ROOT
    try {
        goversioninfo -o $sysoOut $vjsonTmp
        Write-Ok "Embedded icon .syso generated"
    } finally {
        Pop-Location
        Remove-Item $vjsonTmp -ErrorAction SilentlyContinue
    }
}

# ── Step: install binary ──────────────────────────────────────────────────

function Win-InstallBinary {
    Ensure-Dir $INSTALL_DIR
    Copy-Item (Join-Path $script:REPO_ROOT "bin\tracker.exe") $BIN_DEST -Force
    Write-Ok "Binary installed → $BIN_DEST"

    # Add to user PATH
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    if ($userPath -notlike "*$INSTALL_DIR*") {
        [System.Environment]::SetEnvironmentVariable("Path", "$userPath;$INSTALL_DIR", "User")
        $env:Path = "$env:Path;$INSTALL_DIR"
        Write-Ok "Added $INSTALL_DIR to user PATH"
    } else {
        Write-Skip "PATH already contains $INSTALL_DIR"
    }
}

# ── Step: background service (NSSM) with Scheduled Task fallback ──────────

function Win-InstallService {
    Ensure-Dir $script:DATA_DIR

    if (Test-HaveCmd "nssm") {
        _InstallNssm
    } elseif (Confirm-Action "Install NSSM service manager? (recommended — requires admin)" -AssumeYes:$script:ASSUME_YES) {
        Write-Info "Installing NSSM..."
        Install-WithPM "NSSM.NSSM" "nssm"
        # Reload PATH
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + $env:Path
        _InstallNssm
    } else {
        Write-Warn "Using Scheduled Task fallback (starts at logon, no admin required)"
        _InstallScheduledTask
    }
}

function _InstallNssm {
    if (-not (Test-IsAdmin)) {
        Exit-Error "NSSM service creation requires administrator privileges. Re-run as admin or choose the Scheduled Task fallback."
    }

    # Remove existing NSSM service if present
    $existing = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    if ($existing) {
        nssm stop $SERVICE_NAME  2>&1 | Out-Null
        nssm remove $SERVICE_NAME confirm 2>&1 | Out-Null
    }

    nssm install   $SERVICE_NAME $BIN_DEST
    nssm set       $SERVICE_NAME AppParameters "--listen `"$($script:LISTEN)`" --enable-logs"
    nssm set       $SERVICE_NAME AppDirectory  $script:DATA_DIR
    nssm set       $SERVICE_NAME AppEnvironmentExtra "WT_DATA_DIR=$($script:DATA_DIR)"
    nssm set       $SERVICE_NAME Start SERVICE_AUTO_START
    nssm set       $SERVICE_NAME AppStdout (Join-Path $script:DATA_DIR "tracker.log")
    nssm set       $SERVICE_NAME AppStderr (Join-Path $script:DATA_DIR "tracker.log")
    nssm start     $SERVICE_NAME

    Write-Ok "NSSM service '$SERVICE_NAME' installed and started"
    Write-Info "  Status:  Get-Service $SERVICE_NAME"
    Write-Info "  Stop:    nssm stop $SERVICE_NAME"
    Write-Info "  Logs:    $($script:DATA_DIR)\tracker.log"
}

function _InstallScheduledTask {
    $action  = New-ScheduledTaskAction -Execute $BIN_DEST `
                   -Argument "--listen `"$($script:LISTEN)`" --enable-logs" `
                   -WorkingDirectory $script:DATA_DIR
    $trigger = New-ScheduledTaskTrigger -AtLogOn
    $settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

    # Environment variable via task XML is not supported directly; use a wrapper approach
    $taskName = "WhatsAppTracker"
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -RunLevel Limited -Force | Out-Null

    # Start immediately
    Start-ScheduledTask -TaskName $taskName

    Write-Ok "Scheduled Task '$taskName' registered (starts at logon)"
    Write-Warn "Set WT_DATA_DIR=$($script:DATA_DIR) as a user environment variable for proper data dir:"
    Write-Warn "  [System.Environment]::SetEnvironmentVariable('WT_DATA_DIR','$($script:DATA_DIR)','User')"
    [System.Environment]::SetEnvironmentVariable("WT_DATA_DIR", $script:DATA_DIR, "User")
    Write-Ok "WT_DATA_DIR set as user environment variable"
}

# ── Step: DNS — hosts file entry ──────────────────────────────────────────

function Win-ConfigureDns {
    Write-Warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    Write-Warn "  DNS NOTICE"
    Write-Warn "  Windows has no dnsmasq. The domain will be mapped via the"
    Write-Warn "  hosts file (C:\Windows\System32\drivers\etc\hosts)."
    Write-Warn "  This requires administrator privileges."
    Write-Warn ""
    Write-Warn "  The '.local' TLD is reserved for mDNS. Some tools may"
    Write-Warn "  override this. If resolution fails, re-run with:"
    Write-Warn "    -Domain wa-analytics.test"
    Write-Warn "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if (-not (Confirm-Action "Map $($script:DOMAIN) → 127.0.0.1 in the hosts file?" -AssumeYes:$script:ASSUME_YES)) {
        Write-Info "Skipped. Access the app at http://localhost$($script:LISTEN)"
        return
    }

    if (-not (Test-IsAdmin)) {
        Write-Warn "Hosts file requires admin. Re-launching this step elevated..."
        $scriptBlock = "
            `$hostsPath = `"$env:SystemRoot\System32\drivers\etc\hosts`"
            `$marker    = `"# whatsapp-tracker local install`"
            `$entry     = `"127.0.0.1  $($script:DOMAIN)    `$marker`"
            `$content   = Get-Content `$hostsPath
            if (`$content -notmatch [regex]::Escape('$($script:DOMAIN)')) {
                Add-Content -Path `$hostsPath -Value `$entry
                Write-Host 'Added hosts entry for $($script:DOMAIN)'
            } else {
                Write-Host 'Hosts entry already present'
            }
        "
        Start-Process powershell -ArgumentList "-NoProfile -Command $scriptBlock" -Verb RunAs -Wait
    } else {
        Ensure-HostsEntry $script:DOMAIN
    }

    Write-Ok "Domain $($script:DOMAIN) → 127.0.0.1"
    Write-Info "Verify with:  Resolve-DnsName $($script:DOMAIN)"
    Write-Info "Access the app at:  http://$($script:DOMAIN)$($script:LISTEN)"
}

# ── Step: verify ──────────────────────────────────────────────────────────

function Win-Verify {
    Write-Info "Checking binary..."
    if (Test-Path $BIN_DEST) {
        Write-Ok "Binary present at $BIN_DEST"
    } else {
        Write-ErrMsg "Binary not found at $BIN_DEST"
    }

    Write-Info "Checking service..."
    $svc = Get-Service -Name $SERVICE_NAME -ErrorAction SilentlyContinue
    $task = Get-ScheduledTask -TaskName "WhatsAppTracker" -ErrorAction SilentlyContinue
    if ($svc -and $svc.Status -eq "Running") {
        Write-Ok "NSSM service '$SERVICE_NAME' is running"
    } elseif ($task) {
        Write-Ok "Scheduled Task 'WhatsAppTracker' is registered"
    } else {
        Write-Warn "No service or task found — run install again"
    }
}

# ── Uninstall ─────────────────────────────────────────────────────────────

function Win-Uninstall {
    Write-Step "Stopping and removing service"
    if (Test-HaveCmd "nssm") {
        nssm stop   $SERVICE_NAME 2>&1 | Out-Null
        nssm remove $SERVICE_NAME confirm 2>&1 | Out-Null
    }
    Unregister-ScheduledTask -TaskName "WhatsAppTracker" -Confirm:$false -ErrorAction SilentlyContinue

    Write-Step "Removing binary and install dir"
    Remove-Item -Recurse -Force $INSTALL_DIR -ErrorAction SilentlyContinue

    Write-Step "Removing .syso icon artifact"
    Remove-Item (Join-Path $script:REPO_ROOT "cmd\tracker\resource_windows_amd64.syso") -ErrorAction SilentlyContinue

    Write-Step "Removing hosts-file entry"
    if (Test-IsAdmin) {
        Remove-HostsEntry
    } else {
        Write-Warn "Skipping hosts-file cleanup (requires admin). Remove manually:"
        Write-Warn "  Remove the '# whatsapp-tracker local install' line from:"
        Write-Warn "  $env:SystemRoot\System32\drivers\etc\hosts"
    }

    Write-Warn "Data directory NOT removed: $($script:DATA_DIR)"
    Write-Warn "It contains your encryption key (.env). Remove manually when certain."
    Write-Ok "Uninstall complete"
}
