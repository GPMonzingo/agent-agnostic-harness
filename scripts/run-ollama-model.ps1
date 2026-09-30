param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Model
)

$ErrorActionPreference = "Stop"

function Wait-Until([scriptblock]$Check, [string]$Description, [int]$Attempts = 30) {
    for ($i = 0; $i -lt $Attempts; $i++) {
        if (& $Check) { return }
        Start-Sleep -Seconds 2
    }
    throw "$Description did not become ready in time."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "Docker was not found on PATH. Install Docker Desktop or add Docker to PATH."
}

if (-not (docker info 2>$null)) {
    $dockerDesktop = Get-Command "C:\Program Files\Docker\Docker\Docker Desktop.exe" -ErrorAction SilentlyContinue
    if (-not $dockerDesktop) {
        throw "Docker Desktop is not running and its executable was not found."
    }
    Write-Host "Starting Docker Desktop..."
    Start-Process $dockerDesktop.Source | Out-Null
    Wait-Until { docker info 2>$null } "Docker Desktop"
}

Write-Host "Starting Open WebUI..."
docker compose up -d open-webui
Wait-Until {
    try {
        (Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200
    } catch {
        $false
    }
} "Open WebUI"
Write-Host "Opening Open WebUI in the default browser..."
Start-Process "http://localhost:3000"

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
    throw "Ollama was not found on PATH. Install Ollama or add it to PATH."
}

if (-not (ollama list 2>$null)) {
    Write-Host "Starting Ollama..."
    Start-Process ollama -ArgumentList "serve" -WindowStyle Hidden | Out-Null
    Wait-Until { ollama list 2>$null } "Ollama"
}

$loadedModels = ollama ps | Select-Object -Skip 1 | ForEach-Object {
    if ($_ -match '^\s*(\S+)\s+') { $Matches[1] }
} | Where-Object { $_ -and $_ -ne "NAME" }

foreach ($loadedModel in $loadedModels) {
    Write-Host "Stopping loaded model: $loadedModel"
    ollama stop $loadedModel
}

Write-Host "Starting model: $Model"
ollama run $Model
