# WARNING: Simulation mode. Do not use for real merchant acceptance.
$ErrorActionPreference = 'Stop'

$backendDir = Split-Path -Parent $PSScriptRoot
$rootDir = Split-Path -Parent $backendDir
$frontendDir = Join-Path $rootDir 'frontend'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'node is not available in PATH. Install Node.js and try again.'
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm is not available in PATH. Install Node.js/npm and try again.'
}

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

Stop-Ports -Ports @(3000, 3001, 3002, 4040)

$ngrokExe = 'C:\Users\Arsh\AppData\Local\ngrok\ngrok.exe'
if (-not (Test-Path $ngrokExe)) {
  $ngrokCmd = Get-Command ngrok -ErrorAction SilentlyContinue
  if ($ngrokCmd) {
    $ngrokExe = $ngrokCmd.Source
  } else {
    $ngrokExe = $null
  }
}

if ($ngrokExe) {
  Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "& '$ngrokExe' http 3001 --domain=unsaid-carline-incommensurately.ngrok-free.dev"
  )
  Start-Sleep -Seconds 3
} else {
  Write-Warning 'ngrok not found on this machine. Continuing without tunnel.'
}

$simCommand = ('Set-Location ''{0}''; node .\sim\hp2-sim.js' -f $backendDir)
$backendCommand = ('Set-Location ''{0}''; $env:HP2_MOCK=''false''; $env:HP2_BASE_URL=''http://localhost:3002''; $env:ENABLE_SIMULATE_ENDPOINT=''true''; node .\server.js' -f $backendDir)
$frontendCommand = ('Set-Location ''{0}''; npm run dev' -f $frontendDir)

Start-Process powershell -WorkingDirectory $backendDir -ArgumentList @('-NoExit', '-Command', $simCommand)
Start-Sleep -Seconds 2

Start-Process powershell -WorkingDirectory $backendDir -ArgumentList @('-NoExit', '-Command', $backendCommand)
Start-Sleep -Seconds 2

Start-Process powershell -WorkingDirectory $frontendDir -ArgumentList @('-NoExit', '-Command', $frontendCommand)
Start-Sleep -Seconds 3

Start-Process 'http://localhost:3001/demo'

Write-Output ''
Write-Output 'PayPort - SIM MODE'
if ($ngrokExe) {
  Write-Output '  ngrok:    https://unsaid-carline-incommensurately.ngrok-free.dev'
  Write-Output '  Webhook:  https://unsaid-carline-incommensurately.ngrok-free.dev/api/webhook'
} else {
  Write-Output '  ngrok:    not started'
  Write-Output '  Webhook:  local only (no tunnel)'
}
Write-Output '  HP2 Sim:  http://localhost:3002/sim/health'
Write-Output '  Backend:  http://localhost:3001/api/health'
Write-Output '  Frontend: http://localhost:3000/onboard'
Write-Output '  Demo:     http://localhost:3001/demo'
