param(
    [switch]$RunMigrations,
    [switch]$StartDbTunnel,
    [string]$SshKeyPath = "C:\Users\Ankit Shinde\Downloads\stockmarket-vm_key.pem"
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSCommandPath
$backendDir = Join-Path $projectRoot "Backend\ai_stockanalysis"
$frontendDir = Join-Path $projectRoot "Frontend"
$backendPython = Join-Path $backendDir ".venv\Scripts\python.exe"
$managePy = Join-Path $backendDir "manage.py"
$backendEnv = Join-Path $backendDir ".env"
$frontendNodeModules = Join-Path $frontendDir "node_modules"
$sshExe = "C:\WINDOWS\System32\OpenSSH\ssh.exe"
$sshUserHost = "azureuser@20.244.87.117"
$localDbPort = 5433
$remoteDbTarget = "localhost:5432"

function Assert-PathExists {
    param($Path, $Message)
    if (-not (Test-Path -LiteralPath $Path)) {
        throw $Message
    }
}

function Test-LocalPortListening {
    param($Port)
    try {
        return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
    } catch {
        return $false
    }
}

# ✅ Basic checks
Assert-PathExists $backendDir "Backend folder not found"
Assert-PathExists $frontendDir "Frontend folder not found"
Assert-PathExists $backendPython "Python venv not found"
Assert-PathExists $managePy "manage.py missing"
Assert-PathExists $frontendNodeModules "Run npm install in Frontend first"

# ✅ npm check
$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
    $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
}
if (-not $npmCommand) {
    throw "npm not found. Install Node.js."
}

# ✅ ENV warning
if (-not (Test-Path $backendEnv)) {
    Write-Warning ".env file missing"
}

# =========================
# 🔥 SSH TUNNEL FIXED BLOCK
# =========================
if ($StartDbTunnel) {

    Assert-PathExists $sshExe "ssh.exe not found"
    Assert-PathExists $SshKeyPath "SSH key not found: $SshKeyPath"

    if (Test-LocalPortListening $localDbPort) {
        Write-Host "Tunnel already running on localhost:$localDbPort" -ForegroundColor Yellow
    }
    else {
        Write-Host "Starting DB tunnel on port $localDbPort ..." -ForegroundColor Cyan

        Start-Process -FilePath $sshExe -ArgumentList @(
            "-i", "`"$SshKeyPath`"",
            "-o", "ExitOnForwardFailure=yes",
            "-o", "StrictHostKeyChecking=accept-new",
            "-L", "$localDbPort`:$remoteDbTarget",
            "-N"
            $sshUserHost
        ) -WindowStyle Hidden

        Start-Sleep -Seconds 5

        if (-not (Test-LocalPortListening $localDbPort)) {
            throw "Tunnel failed. Try running SSH manually once."
        }

        Write-Host "Tunnel started successfully on localhost:$localDbPort" -ForegroundColor Green
    }
}

# =========================
# Django migrations
# =========================
if ($RunMigrations) {
    Write-Host "Running migrations..." -ForegroundColor Cyan
    & $backendPython $managePy migrate
}

# =========================
# Backend
# =========================
$backendCommand = "cd '$backendDir'; & '$backendPython' '$managePy' runserver 127.0.0.1:8000"

Write-Host "Starting backend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCommand

Start-Sleep -Seconds 2

# =========================
# Frontend
# =========================
$frontendCommand = "cd '$frontendDir'; npm run dev -- --host 127.0.0.1 --port 5173"

Write-Host "Starting frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendCommand

Write-Host ""
Write-Host "🚀 Project running:" -ForegroundColor Cyan
Write-Host "Backend:  http://127.0.0.1:8000"
Write-Host "Frontend: http://127.0.0.1:5173"
Write-Host "DB:       localhost:$localDbPort"