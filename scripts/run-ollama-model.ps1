param(
 [Parameter(Mandatory=$true, Position=0)][string]$Model,
 [switch]$WebUI,
 [switch]$CheckOnly
)
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:11434'
try { $tags = Invoke-RestMethod "$base/api/tags" -TimeoutSec 3 } catch {
 $exe = (Get-Command ollama -ErrorAction Stop).Source
 Start-Process -FilePath $exe -ArgumentList 'serve' -WindowStyle Hidden
 for ($attempt=0; $attempt -lt 30; $attempt++) {
  Start-Sleep -Seconds 2
  try { $tags = Invoke-RestMethod "$base/api/tags" -TimeoutSec 2; break } catch {}
 }
 if (-not $tags) { throw 'Ollama did not start on port 11434.' }
}
$name = if ($Model.Contains(':')) { $Model } else { "${Model}:latest" }
if ($name -notin $tags.models.name) { throw "Model $name is not installed. Import its Modelfile with ollama create, or install a valid registry model first." }
Write-Host "Ollama is ready. Model: $name"
if ($CheckOnly) { exit 0 }
Write-Host 'Loading model (first load may take several minutes)...'
$body = @{model=$name; stream=$false; keep_alive='30m'} | ConvertTo-Json
Invoke-RestMethod "$base/api/generate" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 600 | Out-Null
Write-Host "Model loaded. Select $Model in Agent Harness Chat settings."
if ($WebUI) {
 Push-Location (Split-Path -Parent $PSScriptRoot)
 try {
  docker compose up -d open-webui
  if ($LASTEXITCODE -ne 0) { throw 'Open WebUI failed to start. Check Docker Desktop.' }
  Start-Process 'http://localhost:3000'
 } finally { Pop-Location }
}
