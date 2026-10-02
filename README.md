# Agent-Agnostic Harness

A local repository intelligence layer for small and mid-sized coding models. It discovers repository facts deterministically, then builds a small context package for any model provider.

## Quick start

```powershell
python -m pip install -e .
ai-harness index
ai-harness context "fix failed login handling"
ai-harness search "login"
ai-harness symbol AuthService
python -m pytest
```

The index is stored in `.ai/index.json`; knowledge files are intended to be reviewed and refined by humans. The context command never calls a model and is useful for tuning local quantized models.

## Design

`harness.indexer` scans non-ignored source files, extracts lightweight symbols/imports, and caches metadata. `harness.search` exposes local lookup operations. `harness.context` ranks direct symbol/search hits above repository knowledge and enforces configurable budgets. The TypeScript `src/` harness owns the provider-neutral execution lifecycle: request contracts, registries, policy, routing, retries, fallbacks, telemetry, and tools. A local Ollama/llama.cpp/LM Studio/vLLM adapter can be added without changing application-facing contracts.

Sensitive files and common generated/dependency directories are excluded by default. Add patterns to `.aiignore` for repository-specific exclusions. No network or external model is required.

## Local models and Open WebUI

Keep model weights outside the repository. Use `config/local-models.json` for local model aliases and capabilities; the example is at `config/local-models.example.json`. Ollama should manage its own model store, while file-based runtimes can use a separate directory such as `D:\AI\models`.

Open WebUI is defined in `docker-compose.yml` and expects Ollama on the host at port `11434`:

```powershell
docker compose up -d open-webui
```

Then open `http://localhost:3000`. The compose configuration uses `host.docker.internal`, the Docker volume `open-webui`, and the same host-to-container routing as the command you provided. Start Ollama on the host before using models through Open WebUI.

To ensure only one model is loaded at a time, stop every currently loaded model before starting the model you want:

```powershell
$model = "granite4.2-3b-bf16:latest"
$loaded = ollama ps | Select-Object -Skip 1 | ForEach-Object {
    if ($_ -match '^\s*(\S+)\s+') { $Matches[1] }
} | Where-Object { $_ -and $_ -ne "NAME" }
$loaded | ForEach-Object { ollama stop $_ }
ollama run $model
```

Replace `$model` when switching models. `ollama ps` should show only the selected model after it starts.

## Browser office and chat extension

Run the office npm script and open http://127.0.0.1:4310. The extension is chat-only. See [office setup and Codex integration](office/README.md) for installation, customization and connection limits.
