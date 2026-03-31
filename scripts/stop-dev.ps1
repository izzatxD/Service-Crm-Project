$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$stateDir = Join-Path $root '.dev'
$frontendPidFile = Join-Path $stateDir 'frontend.pid'
$backendPidFile = Join-Path $stateDir 'backend.pid'

function Stop-TrackedProcess {
  param(
    [string]$PidFile,
    [string]$Name
  )

  if (-not (Test-Path $PidFile)) {
    Write-Host "${Name}: not running"
    return
  }

  $pidValue = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue
  $process = $null
  if ($pidValue) {
    $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
  }

  if ($process) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    Write-Host "${Name}: stopped ($($process.Id))"
  } else {
    Write-Host "${Name}: pid file found, process already stopped"
  }

  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

Stop-TrackedProcess -PidFile $frontendPidFile -Name 'frontend'
Stop-TrackedProcess -PidFile $backendPidFile -Name 'backend'
