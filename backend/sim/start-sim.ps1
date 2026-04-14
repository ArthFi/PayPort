$ErrorActionPreference = 'Stop'

$backendDir = Split-Path -Parent $PSScriptRoot
$simDir = $PSScriptRoot
$rootDir = Split-Path -Parent $backendDir
$frontendDir = Join-Path $rootDir 'frontend'

function Use-Node20IfAvailable {
  if (-not $env:NVM_HOME) {
    Write-Host 'NVM_HOME is not set. Using existing PATH node/npm.'
    return ''
  }

  $nodeHome = Join-Path $env:NVM_HOME 'v20.20.2'
  $npmBin = Join-Path $nodeHome 'node_modules\npm\bin'

  if (-not (Test-Path $nodeHome)) {
    Write-Host "Node v20.20.2 not found at $nodeHome. Using existing PATH node/npm."
    return ''
  }

  $env:Path = "$nodeHome;$npmBin;$env:Path"
  return "$nodeHome;$npmBin"
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
      if (-not $procId) { continue }
      if ($killed.ContainsKey($procId)) { continue }

      try {
        Stop-Process -Id $procId -ErrorAction Stop
      } catch {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
      }

      $killed[$procId] = $true
      Write-Host "Stopped PID $procId on port $port"
    }
  }
}

$subprocessPathPrefix = Use-Node20IfAvailable
Stop-Ports -Ports @(3000, 3001, 3002, 4040)

$pathPrefixPart = if ($subprocessPathPrefix) { "$env:Path = '$subprocessPathPrefix;' + `$env:Path; " } else { '' }

$simCommand = @(
  $pathPrefixPart,
  "Set-Location '$simDir'; ",
  "node hp2-sim.js"
) -join ''

$backendCommand = @(
  $pathPrefixPart,
  "Set-Location '$backendDir'; ",
  "`$env:HP2_MOCK='true'; ",
  "`$env:ENABLE_SIMULATE_ENDPOINT='true'; ",
  "`$env:HP2_BASE_URL='http://localhost:3002'; ",
  "node server.js"
) -join ''

$frontendCommand = @(
  $pathPrefixPart,
  "Set-Location '$frontendDir'; ",
  "npm run dev"
) -join ''

Start-Process powershell -WorkingDirectory $simDir -ArgumentList @('-NoExit', '-Command', $simCommand)
Start-Sleep -Seconds 2

Start-Process powershell -WorkingDirectory $backendDir -ArgumentList @('-NoExit', '-Command', $backendCommand)
Start-Sleep -Seconds 2

Start-Process powershell -WorkingDirectory $frontendDir -ArgumentList @('-NoExit', '-Command', $frontendCommand)
Start-Sleep -Seconds 2

Start-Process 'http://localhost:3001/demo'

Write-Host "SIM mode startup launched"
Write-Host "sim:       http://localhost:3002/health"
Write-Host "backend:   http://localhost:3001/api/health"
Write-Host "frontend:  http://localhost:3000/onboard"
Write-Host "demo:      http://localhost:3001/demo"
