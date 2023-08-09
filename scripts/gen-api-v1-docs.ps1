# This script generates API documentation using swaggo/swag

# For more details, check the docs:
# * https://usememos.com/docs/contribution/development
# * https://github.com/usememos/memos/blob/main/docs/api/documentation.md

# Requirements:
# * go

# swag is configured mainly via gen-api-v1-docs.cfg file.

# Usage:
# ./scripts/gen-api-v1-docs.ps1

foreach ($dir in @(".", "../")) {
    if (Test-Path (Join-Path $dir ".gitignore")) {
        $repoRoot = (Resolve-Path $dir).Path
        break
    }
}
Set-Location $repoRoot

Write-Host "Parsing gen-api-v1-docs.cfg..."
foreach ($line in (Get-Content "$repoRoot\scripts\gen-api-v1-docs.cfg" )) {
    if ($line.Trim().StartsWith('#')) {
        continue
    }
    $name, $value = $line.split('=')
    if ([string]::IsNullOrWhiteSpace($name)) {
        continue
    }
    Set-Content env:\$name $value    
}

Write-Host "API directories: $env:SWAG_API_DIRS" -f Cyan
Write-Host "Output directory: $env:SWAG_OUTPUT" -f Cyan
Write-Host "General info: $env:SWAG_GENERAL_INFO" -f Cyan

$swag = (Get-Command swag -ErrorAction SilentlyContinue).Path
if (-not $swag) {   
    foreach ($path in @((Join-Path $HOME "go/bin"), (Join-Path $env:GOPATH "/bin"))) {
        $swag = Join-Path (Resolve-Path $path).Path "swag.exe"
        if (Test-Path $swag) {
            break
        }
    }
}
if (-not (Test-Path $swag)) {
    Write-Host "Swag is not installed. Installing..." -f Magenta
    go install github.com/swaggo/swag/cmd/swag@latest
}

$generalInfoPath = (Split-Path (Resolve-Path $env:SWAG_GENERAL_INFO -Relative) -Parent)
$apiDirs = $env:SWAG_API_DIRS -split ',' | ForEach-Object { "$(Resolve-Path $_ -Relative)" }
$swagFmtDirs = $generalInfoPath + "," + $($apiDirs -join ",")

Write-Host "Formatting comments via ``swag fmt --dir `"$swagFmtDirs`"``..." -f Magenta
&$swag fmt --dir "`"${swagFmtDirs}`""

$goFmtDirs = $swagFmtDirs -split ',' | ForEach-Object { "`"$($_)`"" }

# This is just in case swag fmt do something non-conforming to go fmt
Write-Host "Formatting code via ``go fmt ${goFmtDirs}``..." -f Magenta
go fmt ${goFmtDirs}

Write-Host "Generating Swagger API documentation..." -f Magenta
&$swag init --output $env:SWAG_OUTPUT --outputTypes $env:SWAG_OUTPUT_TYPES --generalInfo $env:SWAG_GENERAL_INFO --dir "./,${env:SWAG_API_DIRS}"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to generate API documentation!" -f Red
    exit $LASTEXITCODE
}
Write-Host "API documentation updated!" -f Green
