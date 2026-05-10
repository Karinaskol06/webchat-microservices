Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "run-webchat.ps1"
powershell -ExecutionPolicy Bypass -File $scriptPath -Mode modeA -Action down
