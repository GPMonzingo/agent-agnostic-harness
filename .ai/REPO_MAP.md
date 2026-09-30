# Repository Map

## `src/`
TypeScript production harness. `src/index.ts` is the public barrel export.

### `src/core/`
Provider-neutral contracts and lifecycle: request/response types, model/provider registries, policy, capability filtering, routing, execution, telemetry, and tools.

### `src/providers/`
Provider adapters. `http-local.ts` is a generic local HTTP adapter for `/generate` endpoints.

## `harness/`
Python repository-intelligence layer. It scans source files, creates `.ai/index.json`, extracts symbols/imports, searches code, and builds targeted context without calling a model.

## `tests/`
Python tests using temporary repositories. These cover scanning, symbols, imports, search, sensitive-file exclusion, context selection, and cache round trips.

## `.ai/`
Human-maintained and generated knowledge for coding agents. `index.json` is generated and ignored by Git; the other Markdown/JSON files are prompt guidance.

Important guidance files include `AGENT_INSTRUCTIONS.md` and `HARNESS_SPEC.md`.

## Root configuration

- `package.json`, `package-lock.json`: Node/TypeScript build and test scripts.
- `tsconfig.json`: strict TypeScript compiler settings.
- `pyproject.toml`: Python package metadata and pytest configuration.
- `.gitignore`: excludes dependencies, build output, Python caches, and the generated repository index.
- `config/`: local model/provider metadata; machine-specific `local-models.json` is ignored.
- `models/`: documentation and optional ignored references; model weights stay outside Git.
- `docker-compose.yml`: Open WebUI container configuration for host Ollama.
