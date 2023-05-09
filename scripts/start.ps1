# This script starts the backend and frontend in development mode, with live reload.
# It also installs frontend dependencies.

# For more details on setting-up a development environment, check the docs:
# https://github.com/usememos/memos/blob/main/docs/development.md

# Usage: ./scripts/start.ps1
$LastExitCode = 0

$projectRoot = (Resolve-Path "$MyInvocation.MyCommand.Path/..").Path
Write-Host "Project root: $projectRoot"

Write-Host "Starting backend..." -f Magenta
Start-Process -WorkingDirectory "$projectRoot" -FilePath "air" "-c ./scripts/.air-windows.toml"
if ($LastExitCode -ne 0) {
    Write-Host "Failed to start backend!" -f Red
    exit $LastExitCode
}
else {
    Write-Host "Backend started!" -f Green
}

Write-Host "Installing frontend dependencies..." -f Magenta
Start-Process -Wait -WorkingDirectory "$projectRoot/web" -FilePath "powershell" -ArgumentList "pnpm i"
if ($LastExitCode -ne 0) {
    Write-Host "Failed to install frontend dependencies!" -f Red
    exit $LastExitCode
}
else {
    Write-Host "Frontend dependencies installed!" -f Green
}

Write-Host "Starting frontend..." -f Magenta
Start-Process -WorkingDirectory "$projectRoot/web" -FilePath "powershell" -ArgumentList "pnpm dev"
if ($LastExitCode -ne 0) {
    Write-Host "Failed to start frontend!" -f Red
    exit $LastExitCode
}
else {
    Write-Host "Frontend started!" -f Green
}

