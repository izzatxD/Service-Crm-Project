$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$frontendDir = Join-Path $root 'frontend'
$backendDir = Join-Path $root 'backend'
$stateDir = Join-Path $root '.dev'

if (-not (Test-Path $stateDir)) {
  New-Item -ItemType Directory -Path $stateDir | Out-Null
}

$frontendOut = Join-Path $stateDir 'frontend-dev.out.log'
$frontendErr = Join-Path $stateDir 'frontend-dev.err.log'
$backendOut = Join-Path $stateDir 'backend-dev.out.log'
$backendErr = Join-Path $stateDir 'backend-dev.err.log'
$frontendPidFile = Join-Path $stateDir 'frontend.pid'
$backendPidFile = Join-Path $stateDir 'backend.pid'

function Stop-ExistingProcess {
  param(
    [string]$PidFile
  )

  if (-not (Test-Path $PidFile)) {
    return
  }

  $pidValue = Get-Content -LiteralPath $PidFile -ErrorAction SilentlyContinue
  if (-not $pidValue) {
    Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
    return
  }

  $process = Get-Process -Id ([int]$pidValue) -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
  }

  Remove-Item -LiteralPath $PidFile -Force -ErrorAction SilentlyContinue
}

function Stop-ListenerOnPort {
  param(
    [int]$Port
  )

  $connections = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
  if (-not $connections) {
    return
  }

  $processIds = $connections | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($processId in $processIds) {
    if ($processId -gt 0) {
      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
    }
  }
}

function Reset-Log {
  param(
    [string]$Path
  )

  try {
    Set-Content -LiteralPath $Path -Value '' -ErrorAction Stop
  } catch {
    # Ignore locked files
  }
}

Stop-ExistingProcess -PidFile $frontendPidFile
Stop-ExistingProcess -PidFile $backendPidFile
Stop-ListenerOnPort -Port 5173
Stop-ListenerOnPort -Port 3000
Start-Sleep -Seconds 1

Reset-Log -Path $frontendOut
Reset-Log -Path $frontendErr
Reset-Log -Path $backendOut
Reset-Log -Path $backendErr

$frontend = Start-Process -FilePath 'C:\Program Files\nodejs\npm.cmd' `
  -ArgumentList 'run', 'dev', '--', '--host', '0.0.0.0' `
  -WorkingDirectory $frontendDir `
  -RedirectStandardOutput $frontendOut `
  -RedirectStandardError $frontendErr `
  -PassThru

$backend = Start-Process -FilePath 'C:\Program Files\nodejs\npm.cmd' `
  -ArgumentList 'run', 'start:dev' `
  -WorkingDirectory $backendDir `
  -RedirectStandardOutput $backendOut `
  -RedirectStandardError $backendErr `
  -PassThru

$frontend.Id | Set-Content -LiteralPath $frontendPidFile
$backend.Id | Set-Content -LiteralPath $backendPidFile

Start-Sleep -Seconds 6

Write-Host "Frontend: http://localhost:5173/"
Write-Host "Backend:  http://localhost:3000/api"
Write-Host "frontend pid: $($frontend.Id)"
Write-Host "backend pid:  $($backend.Id)"
Write-Host "Logs:"
Write-Host "  $frontendOut"
Write-Host "  $backendOut"
