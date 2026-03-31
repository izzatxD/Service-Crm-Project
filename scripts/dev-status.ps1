$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $root '.dev'
$frontendPidFile = Join-Path $stateDir 'frontend.pid'
$backendPidFile = Join-Path $stateDir 'backend.pid'

function Show-TrackedProcess {
  param(
    [string]$PidFile,
    [string]$Name,
    [string]$Url
  )

  if (-not (Test-Path $PidFile)) {
    Write-Host "${Name}: not tracked"
    return
  }

  $pidValue = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue
  if (-not $pidValue) {
    Write-Host "${Name}: pid file empty"
    return
  }

  $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
  if ($process) {
    Write-Host "${Name}: running ($($process.Id)) -> $Url"
  } else {
    Write-Host "${Name}: not running, stale pid file ($pidValue)"
  }
}

Show-TrackedProcess -PidFile $frontendPidFile -Name 'frontend' -Url 'http://localhost:5173/'
Show-TrackedProcess -PidFile $backendPidFile -Name 'backend' -Url 'http://localhost:3000/api'
