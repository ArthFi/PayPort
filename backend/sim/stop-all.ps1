$ErrorActionPreference = 'Stop'

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
        Write-Host "Port $port had PID $procId (already stopped)"
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
