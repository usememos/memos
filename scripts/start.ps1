# This script starts the backend and frontend in development mode, with live reload.
# It also installs frontend dependencies.

# For more details on setting-up a development environment, check the docs:
# * https://usememos.com/docs/contribution/development
# * https://github.com/usememos/memos/blob/main/docs/development.md

# Usage: ./scripts/start.ps1

foreach ($dir in @(".", "../")) {
    if (Test-Path (Join-Path $dir ".gitignore")) {
        $repoRoot = (Resolve-Path $dir).Path
        break
    }
}

##
$frontendPort = 3001
# Tasks to run, in order
$runTasks = @(
    @{
        Desc = "start backend with live reload";
        Exe  = "air.exe";
        Args = "-c .\scripts\.air-windows.toml";
        Dir  = "$repoRoot";
        Wait = $false;
    },
    @{ 
        Desc = "install frontend dependencies";
        Exe  = "pnpm.exe";
        Args = "i";
        Dir  = "$repoRoot/web"
        Wait = $true;
    }
    @{ 
        Desc = "start frontend with live reload";
        Exe  = "pnpm.exe";
        Args = "dev";
        Dir  = "$repoRoot/web";
        Wait = $false;
    }
)
##

if (!$repoRoot) {
    Write-Host "Could not find repository root!" -f Red
    Write-Host "cd into the repository root and run the script again."
    Exit 1
}

Write-Host "Repository root is $repoRoot"
Write-Host "Starting development environment...`n"
Write-Host @"
███╗   ███╗███████╗███╗   ███╗ ██████╗ ███████╗
████╗ ████║██╔════╝████╗ ████║██╔═══██╗██╔════╝
██╔████╔██║█████╗  ██╔████╔██║██║   ██║███████╗
██║╚██╔╝██║██╔══╝  ██║╚██╔╝██║██║   ██║╚════██║
██║ ╚═╝ ██║███████╗██║ ╚═╝ ██║╚██████╔╝███████║
╚═╝     ╚═╝╚══════╝╚═╝     ╚═╝ ╚═════╝ ╚══════╝
"@

function Stop-ProcessTree {
    Param([int]$ParentProcessId)
    if (!$ParentProcessId) {
        Write-Host "Stop-ProcessTree: unspecified ParentProcessId!" -f Red
        return
    }
    Write-Host "Terminating pid $($ParentProcessId) with all its child processes" -f DarkGray
    Get-CimInstance Win32_Process | Where-Object {
        $_.ParentProcessId -eq $ParentProcessId
    } | ForEach-Object {
        Stop-ProcessTree $_.ProcessId
    }
    Stop-Process -Id $ParentProcessId -ErrorAction SilentlyContinue
}

$maxDescLength = ( $runTasks | ForEach-Object { $_.Desc.Length } | Measure-Object -Maximum).Maximum
$spawnedPids = @()
foreach ($task in $runTasks) {
    Write-Host ("Running task ""$($task.Desc)""...").PadRight($maxDescLength + 20) -f Blue -NoNewline
    $task.Dir = (Resolve-Path $task.Dir).Path
    try {
        $process = Start-Process -PassThru -WorkingDirectory $task.Dir -FilePath $task.Exe -ArgumentList $task.Args -Wait:$task.Wait

        if ($process.ExitCode -and $process.ExitCode -ne 0) {
            # ExitCode only works for processes started with -Wait:$true
            throw "Process exited with code $($process.ExitCode)"
        }

        Write-Host "[OK]" -f Green
        $spawnedPids += $process.Id
    }
    catch {
        Write-Host "[FAILED]" -f Red
        Write-Host "Error: $_" -f Red
        Write-Host "Unable to execute: $($task.Exe) $($task.Args)" -f Red
        Write-Host "Process working directory: $($task.Dir)" -f Red

        foreach ($spawnedPid in $spawnedPids) {
            Stop-ProcessTree -ParentProcessId $spawnedPid
        }
        Exit $process.ExitCode
    }
}

Write-Host "Front-end should be accessible at:" -f Green
$ipAddresses = (Get-NetIPAddress -AddressFamily IPv4) | Select-Object -ExpandProperty IPAddress | Sort-Object
$ipAddresses += "localhost"
foreach ($ip in $ipAddresses) {
    Write-Host "· http://$($ip):$($frontendPort)" -f Cyan
}

Write-Host "`nPress" -NoNewline
Write-Host " Ctrl + C" -f DarkYellow -NoNewline
Write-Host " or" -NoNewline
Write-Host " Esc" -f DarkYellow -NoNewline
Write-Host " to terminate running servers." -f DarkYellow
[Console]::TreatControlCAsInput = $true

$lastPoll = 0
$noWaitTasks = $runTasks | Where-Object { $_.Wait -eq $false }
while ($true) {
    if ([Console]::KeyAvailable) {
        $readkey = [Console]::ReadKey("AllowCtrlC,IncludeKeyUp,NoEcho")
        if ($readkey.Modifiers -eq "Control" -and $readkey.Key -eq "C") {
            break
        }
        if ($readkey.Key -eq "Escape") {
            Break
        }
    }

    # Poll for processes that exited unexpectedly
    # Do this every 5 seconds to avoid excessive CPU usage
    if (([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - $lastPoll) -ge 5000) {
        $noWaitTasks | ForEach-Object {
            $name = $_.Exe.TrimEnd(".exe")
            if (!(Get-Process -Name $name -ErrorAction SilentlyContinue)) {
                Write-Host "Process " -f Red -NoNewline
                Write-Host $name -NoNewline -f DarkYellow
                Write-Host " is not running anymore!" -f Red
                break
            }
        }
        $lastPoll = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
    }
    Start-Sleep -Milliseconds 500
}

foreach ($spawnedPid in $spawnedPids) {
    Stop-ProcessTree -ParentProcessId $spawnedPid
}

Write-Host "Exiting..."
