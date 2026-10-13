$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$localDir = Join-Path $root ".local"
$python = Join-Path $backendDir ".venv\Scripts\python.exe"
$vite = Join-Path $frontendDir "node_modules\vite\bin\vite.js"
$pythonPidFile = Join-Path $localDir "backend.pid"
$frontendPidFile = Join-Path $localDir "frontend.pid"
$backendLog = Join-Path $localDir "backend.log"
$backendErrorLog = Join-Path $localDir "backend-error.log"
$frontendLog = Join-Path $localDir "frontend.log"
$frontendErrorLog = Join-Path $localDir "frontend-error.log"
$apiUrl = "http://127.0.0.1:8000/api/health"
$appUrl = "http://127.0.0.1:5174/"

function Test-Url($url) {
    try {
        Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Wait-ForUrl($url, $process, $logPath, $errorLogPath, $serviceName) {
    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (Test-Url $url) {
            return
        }
        if ($process.HasExited) {
            $details = (Get-Content $logPath, $errorLogPath -Raw -ErrorAction SilentlyContinue) -join "`n"
            throw "$serviceName stopped before becoming ready.`n$details"
        }
        Start-Sleep -Seconds 1
    }
    throw "$serviceName did not become ready at $url. See $logPath"
}

New-Item -ItemType Directory -Path $localDir -Force | Out-Null

if (-not (Test-Path $python)) {
    $pythonLauncher = Get-Command py.exe -ErrorAction SilentlyContinue
    if ($pythonLauncher) {
        & $pythonLauncher.Source -3 -m venv (Join-Path $backendDir ".venv")
    } else {
        $pythonCommand = Get-Command python.exe -ErrorAction SilentlyContinue
        if (-not $pythonCommand) {
            throw "Python 3.11+ is required. Install Python, then run this script again."
        }
        & $pythonCommand.Source -m venv (Join-Path $backendDir ".venv")
    }
    if ($LASTEXITCODE -ne 0) {
        throw "Could not create the backend virtual environment."
    }
    & $python -m pip install -r (Join-Path $backendDir "requirements.txt")
    if ($LASTEXITCODE -ne 0) {
        throw "Backend dependency installation failed."
    }
}

if (-not (Test-Path $vite)) {
    $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if (-not $npm) {
        throw "Node.js 20+ and npm are required. Install them, then run this script again."
    }
    Push-Location $frontendDir
    try {
        & $npm.Source ci
        if ($LASTEXITCODE -ne 0) {
            throw "Frontend dependency installation failed."
        }
    } finally {
        Pop-Location
    }
}

if (-not (Test-Url $apiUrl)) {
    $portOwner = Get-NetTCPConnection -State Listen -LocalPort 8000 -ErrorAction SilentlyContinue
    if ($portOwner) {
        throw "Port 8000 is already in use by another service. Stop it or change its port before starting Velaire."
    }
    Remove-Item $backendLog -Force -ErrorAction SilentlyContinue
    Remove-Item $backendErrorLog -Force -ErrorAction SilentlyContinue
    $backendProcess = Start-Process -FilePath $python -ArgumentList "run_local.py" -WorkingDirectory $backendDir -WindowStyle Hidden -RedirectStandardOutput $backendLog -RedirectStandardError $backendErrorLog -PassThru
    Set-Content -Path $pythonPidFile -Value $backendProcess.Id
    Wait-ForUrl $apiUrl $backendProcess $backendLog $backendErrorLog "Velaire API"
}

if (-not (Test-Url $appUrl)) {
    $portOwner = Get-NetTCPConnection -State Listen -LocalPort 5174 -ErrorAction SilentlyContinue
    if ($portOwner) {
        throw "Port 5174 is already in use by another service. Stop it or change its port before starting Velaire."
    }
    $node = Get-Command node.exe -ErrorAction SilentlyContinue
    if (-not $node) {
        throw "Node.js 20+ is required. Install it, then run this script again."
    }
    Remove-Item $frontendLog -Force -ErrorAction SilentlyContinue
    Remove-Item $frontendErrorLog -Force -ErrorAction SilentlyContinue
    $frontendProcess = Start-Process -FilePath $node.Source -ArgumentList @("`"$vite`"", "--host", "127.0.0.1", "--port", "5174", "--strictPort") -WorkingDirectory $frontendDir -WindowStyle Hidden -RedirectStandardOutput $frontendLog -RedirectStandardError $frontendErrorLog -PassThru
    Set-Content -Path $frontendPidFile -Value $frontendProcess.Id
    Wait-ForUrl $appUrl $frontendProcess $frontendLog $frontendErrorLog "Velaire frontend"
}

Write-Host ""
Write-Host "Velaire is ready: $appUrl" -ForegroundColor Green
Write-Host "API docs:        http://127.0.0.1:8000/docs"
Write-Host "Demo login:      manager@example.com / Demo123!"
Write-Host "Stop services:   .\stop-local.ps1"
Start-Process $appUrl
