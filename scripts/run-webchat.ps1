param(
    [ValidateSet("modeA", "modeB")]
    [string]$Mode = "modeB",
    [ValidateSet("up", "down", "status")]
    [string]$Action = "up"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $RepoRoot

function Load-EnvFile([string]$Path) {
    Get-Content $Path | Where-Object { $_ -notmatch '^\s*#' -and $_ -match '=' } | ForEach-Object {
        $name, $val = $_ -split '=', 2
        if ($name.Trim()) {
            [Environment]::SetEnvironmentVariable($name.Trim(), $val.Trim(), "Process")
        }
    }
}

function Stop-PortProcesses([int[]]$Ports) {
    foreach ($port in $Ports) {
        Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
            } catch {
                Write-Warning "Failed to stop PID $($_.OwningProcess) on port $port"
            }
        }
    }
}

function Start-ModeBServices([string]$EnvFilePath) {
    $services = @("user-service", "auth-service", "chat-service", "notification-service", "api-gateway")
    $logsDir = Join-Path $RepoRoot "logs"
    if (-not (Test-Path $logsDir)) {
        New-Item -ItemType Directory -Path $logsDir | Out-Null
    }

    foreach ($svc in $services) {
        $logPath = Join-Path $logsDir "$svc.log"
        $cmd = @"
Set-Location '$RepoRoot'
Get-Content '$EnvFilePath' | Where-Object { `$_ -notmatch '^\s*#' -and `$_ -match '=' } | ForEach-Object {
  `$name, `$val = `$_ -split '=', 2
  [Environment]::SetEnvironmentVariable(`$name.Trim(), `$val.Trim(), 'Process')
}
mvn -pl $svc spring-boot:run *>> '$logPath'
"@
        Start-Process -FilePath "powershell" -ArgumentList "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $cmd | Out-Null
        Start-Sleep -Milliseconds 300
    }
}

if ($Mode -eq "modeA") {
    $envFile = Join-Path $RepoRoot ".env.modeA"
    $composeFile = Join-Path $RepoRoot "docker-compose.yaml"
    $projectName = ""
} else {
    $envFile = Join-Path $RepoRoot ".env.modeB"
    $composeFile = Join-Path $RepoRoot "docker-compose.dev.yml"
    $projectName = "webchatdev"
}

if (-not (Test-Path $envFile)) {
    throw "Missing env file: $envFile"
}

switch ($Action) {
    "status" {
        if ($Mode -eq "modeA") {
            docker compose --env-file $envFile -f $composeFile ps
        } else {
            docker compose --env-file $envFile -f $composeFile -p $projectName ps
            "`nLocal service ports:"
            netstat -ano | findstr ":8081 :8082 :8083 :8084 :8089"
        }
    }
    "down" {
        if ($Mode -eq "modeA") {
            docker compose --env-file $envFile -f $composeFile down
        } else {
            Stop-PortProcesses -Ports @(8081, 8082, 8083, 8084, 8089)
            docker compose --env-file $envFile -f $composeFile -p $projectName down
        }
    }
    "up" {
        if ($Mode -eq "modeA") {
            $env:DOCKER_BUILDKIT = "1"
            docker compose --env-file $envFile -f $composeFile up -d --build
        } else {
            $env:DOCKER_BUILDKIT = "1"
            docker compose --env-file $envFile -f $composeFile -p $projectName up -d
            Load-EnvFile $envFile
            mvn -pl shared-module -am install -DskipTests | Out-Null
            Stop-PortProcesses -Ports @(8081, 8082, 8083, 8084, 8089)
            Start-ModeBServices -EnvFilePath $envFile
            "Mode B started. Service logs: $RepoRoot\logs\*.log"
        }
    }
}
