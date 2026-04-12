$ErrorActionPreference = 'Stop'

$backendDir = Split-Path -Parent $PSScriptRoot
$rootDir = Split-Path -Parent $backendDir
$frontendDir = Join-Path $rootDir 'frontend'

if (-not $env:NVM_HOME) {
  throw 'NVM_HOME is not set. Install/use nvm-windows and try again.'
}

$nodeHome = Join-Path $env:NVM_HOME 'v20.20.2'
$npmBin = Join-Path $nodeHome 'node_modules\npm\bin'

if (-not (Test-Path $nodeHome)) {
  throw "Node v20.20.2 not found at $nodeHome"
}

$env:Path = "$nodeHome;$npmBin;$env:Path"

function Stop-Ports {
  param([int[]]$Ports)

  $killed = @{}

  foreach ($port in $Ports) {
    $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

    if (-not $listeners) {
      Write-Host "Port $port is free"
      continue
    }

    $pids = $listeners | Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($procId in $pids) {
      if (-not $procId) {
        continue
      }

      if ($killed.ContainsKey($procId)) {
        Write-Host "Port $port was using PID $procId (already stopped)"
        continue
      }

      try {
        Stop-Process -Id $procId -ErrorAction Stop
        Write-Host "Stopped PID $procId on port $port"
      } catch {
        try {
          Stop-Process -Id $procId -Force -ErrorAction Stop
          Write-Host "Force-stopped PID $procId on port $port"
        } catch {
          Write-Warning ("Could not stop PID {0} on port {1} - {2}" -f $procId, $port, $_.Exception.Message)
          continue
        }
      }

      $killed[$procId] = $true
    }
  }
}

Stop-Ports -Ports @(3000, 3001, 3002)

# Prefer local ngrok binary to avoid resolving older shim versions on PATH.
$ngrokExe = 'C:\Users\EDITH\AppData\Local\ngrok\ngrok.exe'
if (-not (Test-Path $ngrokExe)) {
  $ngrokExe = 'ngrok'
}

# Start ngrok first so webhook endpoint is ready before backend/services boot.
Start-Process powershell -ArgumentList @(
  '-NoExit', '-Command',
  "& '$ngrokExe' http 3001 --domain=unsaid-carline-incommensurately.ngrok-free.dev"
)
Start-Sleep -Seconds 3

$subprocessPathPrefix = "$nodeHome;$npmBin"
# Note: This script is for local simulation flow. For real HP2 mode
# (HP2_MOCK=false and QA/production base URL), do not run sim/hp2-sim.js.
$simCommand = ('$env:Path = ''{0};'' + $env:Path; Set-Location ''{1}''; node sim\hp2-sim.js' -f $subprocessPathPrefix, $backendDir)
$backendCommand = ('$env:Path = ''{0};'' + $env:Path; Set-Location ''{1}''; node server.js' -f $subprocessPathPrefix, $backendDir)
$frontendCommand = ('$env:Path = ''{0};'' + $env:Path; Set-Location ''{1}''; npm run dev' -f $subprocessPathPrefix, $frontendDir)

Start-Process powershell -WorkingDirectory $backendDir -ArgumentList @('-NoExit', '-Command', $simCommand)
Start-Sleep -Seconds 2

Start-Process powershell -WorkingDirectory $backendDir -ArgumentList @('-NoExit', '-Command', $backendCommand)
Start-Sleep -Seconds 2

Start-Process powershell -WorkingDirectory $frontendDir -ArgumentList @('-NoExit', '-Command', $frontendCommand)
Start-Sleep -Seconds 3

Start-Process 'http://localhost:3001/demo'

Write-Output "⬡ ngrok tunnel: https://unsaid-carline-incommensurately.ngrok-free.dev"
Write-Output "  Webhook: https://unsaid-carline-incommensurately.ngrok-free.dev/api/webhook"

$tick = [char]0x2713
Write-Host "$tick HP2 Sim:   http://localhost:3002/sim/health"
Write-Host "$tick Backend:   http://localhost:3001/api/health"
Write-Host "$tick Dashboard: http://localhost:3000/onboard"
Write-Host "$tick Demo:      http://localhost:3001/demo"
