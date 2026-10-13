$ErrorActionPreference = "Stop"

$localDir = Join-Path $PSScriptRoot ".local"

foreach ($service in @(
    @{ Name = "backend"; Path = (Join-Path $localDir "backend.pid"); Match = "run_local.py" },
    @{ Name = "frontend"; Path = (Join-Path $localDir "frontend.pid"); Match = "vite.js" }
)) {
    if (-not (Test-Path $service.Path)) {
        continue
    }

    $servicePid = [int](Get-Content $service.Path -Raw).Trim()
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $servicePid" -ErrorAction SilentlyContinue
    if ($process -and $process.CommandLine -like "*$($service.Match)*") {
        Stop-Process -Id $servicePid
        Write-Host "Stopped Velaire $($service.Name)."
    }
    Remove-Item $service.Path -Force
}
