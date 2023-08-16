# This script builds memos for all listed platforms.
# It's only for local builds.

# Before using, setup a proper development environment as described here:
# * https://usememos.com/docs/contribution/development
# * https://github.com/usememos/memos/blob/main/docs/development.md

# Requirements:
# * go
# * node.js
# * npm

# Usage: 
# ./scripts/build.ps1
#
# Output: ./build/memos-<os>-<arch>[.exe]

$goBuilds = @(
    # "darwin/amd64"
    # "darwin/arm64"
    # "linux/amd64"
    # "linux/arm64"
    "windows/amd64"
)
$ldFlags = @(
    "-s" # Omit symbol table and debug information
    "-w" # Omit DWARF symbol table
)

##

foreach ($dir in @(".", "../")) {
    if (Test-Path (Join-Path $dir ".gitignore")) {
        $repoRoot = (Resolve-Path $dir).Path
        break
    }
}
if ([string]::IsNullOrWhiteSpace($repoRoot)) {
    Write-Host -BackgroundColor red -ForegroundColor white "Could not find repository root."
    Exit 1
}

Write-Host "Repository root: " -NoNewline
Write-Host $repoRoot -f Blue

Set-Location "$repoRoot/web"

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Installing pnpm..." -f DarkYellow
    npm install -g pnpm
    if (!$?) {
        Write-Host -BackgroundColor red -ForegroundColor white "Could not install pnpm. See above."
        Exit 1
    }
}

Write-Host "`nInstalling frontend dependencies..." -f DarkYellow
pnpm i --frozen-lockfile
if (!$?) {
    Write-Host -BackgroundColor red -ForegroundColor white "Could not install frontend dependencies. See above."
    Exit 1
}
Write-Host "Frontend dependencies installed!" -f green

Write-Host "`nBuilding frontend..." -f DarkYellow
$frontendTime = Measure-Command {
    &pnpm build | Out-Host
}
if (!$?) {
    Write-Host -BackgroundColor red -ForegroundColor white "Could not build frontend. See above."
    Exit 1
} else {
    Write-Host "Frontend built!" -f green
}

Write-Host "`nBacking up frontend placeholder..." -f Magenta
Move-Item "$repoRoot/server/dist" "$repoRoot/server/dist.bak" -Force -ErrorAction Stop
if (!$?) {
    Write-Host -BackgroundColor red -ForegroundColor white "Could not backup frontend placeholder. See above."
    Exit 1
}

Write-Host "Moving frontend build to ./server/dist..." -f Magenta
Move-Item "$repoRoot/web/dist" "$repoRoot/server/" -Force -ErrorAction Stop
if (!$?) {
    Write-Host -BackgroundColor red -ForegroundColor white "Could not move frontend build to /server/dist. See above."
    Exit 1
}

Set-Location $repoRoot
Write-Host "`nBuilding backend..." -f DarkYellow

$backendTime = Measure-Command {
    foreach ($build in $goBuilds) {
        $os, $arch = $build.Split("/")
        $Env:CGO_ENABLED = 0
        $Env:GOOS = $os
        $Env:GOARCH = $arch

        $output = [IO.Path]::Combine($repoRoot, "build", "memos-$os-$arch")
        if ($os -eq "windows") {
            $output += ".exe"
        }

        Write-Host "Building $os/$arch to $output..." -f Blue
        &go build -trimpath -o $output -ldflags="$($ldFlags -join " ")" ./main.go | Out-Host
        if (!$?) {
            Write-Host -BackgroundColor red -ForegroundColor white "'go build' failed for $build ($outputBinary)!. See above."
            continue
        }
    }
} 
Write-Host "Backend built!" -f green

Write-Host "`nFrontend build took $($frontendTime.TotalSeconds) seconds." -f Cyan
Write-Host "Backend builds took $($backendTime.TotalSeconds) seconds." -f Cyan

Write-Host "`nRemoving frontend from ./server/dist ..." -f Magenta
Remove-Item "$repoRoot/server/dist" -Recurse -Force -ErrorAction SilentlyContinue
if (!$?) {
    Write-Host -BackgroundColor red -ForegroundColor white "Could not remove frontend from /server/dist. See above."
    Exit 1
}

Write-Host "Restoring frontend placeholder..." -f Magenta
Move-Item "$repoRoot/server/dist.bak" "$repoRoot/server/dist" -Force -ErrorAction Stop
if (!$?) {
    Write-Host -BackgroundColor red -ForegroundColor white "Could not restore frontend placeholder. See above."
    Exit 1
}

Write-Host "`nBuilds:" -f White
foreach ($build in $goBuilds) {
    $output = [IO.Path]::Combine($repoRoot, "build", "memos-$os-$arch")
    if ($os -eq "windows") {
        $output = "$output.exe"
    }
    Write-Host $output -f White
}

Write-Host -f Green "`nYou can test the build with" -NoNewline
Write-Host -f White "` ./build/memos-<os>-<arch>" -NoNewline
Write-Host -f DarkGray "`.exe" -NoNewline
Write-Host -f White " --mode demo"

Set-Location -Path $repoRoot
