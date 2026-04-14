$ErrorActionPreference = 'Stop'

# Backward-compatible entrypoint: start-all maps to live mode.
& powershell -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot 'start-live.ps1')
