param(
    [switch]$RunMigrations,
    [switch]$StartDbTunnel
)

$launcherPath = Join-Path $PSScriptRoot "run_project.ps1"
$sudipKeyPath = "C:\Users\Sudip\Downloads\stockmarket-vm_key.pem"

if (-not (Test-Path -LiteralPath $launcherPath)) {
    throw "Main launcher not found at $launcherPath"
}

& $launcherPath -RunMigrations:$RunMigrations -StartDbTunnel:$StartDbTunnel -SshKeyPath $sudipKeyPath
