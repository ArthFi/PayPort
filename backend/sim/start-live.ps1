$ErrorActionPreference = 'Stop'

$backendDir = Split-Path -Parent $PSScriptRoot
$rootDir = Split-Path -Parent $backendDir
$backendDir = Join-Path $rootDir 'backend'
$frontendDir = Join-Path $rootDir 'frontend'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'node is not available in PATH. Install Node.js and try again.'
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm is not available in PATH. Install Node.js/npm and try again.'
}

Set-Location $rootDir

foreach ($port in @(3000, 3001, 3002, 4040)) {
  $conns = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
  if ($conns) {
    $conns | Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
  }
}

$ngrokExe = 'C:\Users\Arsh\AppData\Local\ngrok\ngrok.exe'
if (-not (Test-Path $ngrokExe)) {
  $ngrokCmd = Get-Command ngrok -ErrorAction SilentlyContinue
  if ($ngrokCmd) {
    $ngrokExe = $ngrokCmd.Source
  }
  else {
    $ngrokExe = $null
  }
}

if ($ngrokExe) {
  Start-Process powershell -ArgumentList @(
    '-NoExit', '-Command',
    "& '$ngrokExe' http 3001 --domain=unsaid-carline-incommensurately.ngrok-free.dev"
  )
  Start-Sleep -Seconds 4
}
else {
  Write-Warning 'ngrok not found on this machine. Continuing without tunnel.'
}

$backendCommand = ('Set-Location ''{0}''; node .\server.js' -f $backendDir)
$frontendCommand = ('Set-Location ''{0}''; npm run dev' -f $frontendDir)

Start-Process powershell -WorkingDirectory $backendDir -ArgumentList @('-NoExit', '-Command', $backendCommand)
Start-Sleep -Seconds 3

Start-Process powershell -WorkingDirectory $frontendDir -ArgumentList @('-NoExit', '-Command', $frontendCommand)
Start-Sleep -Seconds 5

Start-Process 'http://localhost:3001/demo'

Write-Output ''
Write-Output 'PayPort - LIVE MODE'
Write-Output '  Backend:   http://localhost:3001 (real HP2)'
Write-Output '  Frontend:  http://localhost:3000'
if ($ngrokExe) {
  Write-Output '  Webhook:   https://unsaid-carline-incommensurately.ngrok-free.dev/api/webhook'
}
else {
  Write-Output '  Webhook:   ngrok not started'
}
Write-Output '  Demo:      http://localhost:3001/demo'
Write-Output '  Dashboard: http://localhost:3000/dashboard'
Write-Output ''
Write-Output 'Sim server NOT running (live mode)'
Write-Output 'ENABLE_SIMULATE_ENDPOINT=false (simulate disabled)'
