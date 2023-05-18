# Usage: ./scripts/build.ps1
# This is only for local builds.

# For development, setup a proper environment as described here:
# https://github.com/usememos/memos/blob/main/docs/development.md

$projectRoot = (Resolve-Path "$MyInvocation.MyCommand.Path/..").Path
Write-Host "Project root: $projectRoot"

Write-Host "Building frontend..." -f Magenta
Set-Location "$projectRoot/web"
npm install -g pnpm
pnpm i --frozen-lockfile
pnpm build

Write-Host "Backing up frontend placeholder..." -f Magenta
Move-Item "$projectRoot/server/dist" "$projectRoot/server/dist.bak" -Force -ErrorAction Stop

Write-Host "Moving frontend build to /server/dist ..." -f Magenta
Move-Item "$projectRoot/web/dist" "$projectRoot/server/" -Force -ErrorAction Stop

Set-Location $projectRoot

Write-Host "Building backend..." -f Magenta
go build -o ./build/memos.exe ./main.go
Write-Host "Backend built!" -f green

Write-Host "Removing frontend from /server/dist ..." -f Magenta
Remove-Item "$projectRoot/server/dist" -Recurse -Force -ErrorAction SilentlyContinue

Write-Host "Restoring frontend placeholder..." -f Magenta
Move-Item "$projectRoot/server/dist.bak" "$projectRoot/server/dist" -Force -ErrorAction Stop

Write-Host "You can test the build with ./build/memos.exe --mode demo" -f Green

Set-Location -Path $projectRoot