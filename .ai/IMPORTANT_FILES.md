# Important Files

## Harness entry and contracts

- `src/index.ts`: public exports.
- `src/core/types.ts`: all application-facing request, response, capability, model, route, and usage types.
- `src/core/harness.ts`: `Harness.execute()` lifecycle.
- `config/local-models.example.json`: example local model/provider registry metadata.
- `docker-compose.yml`: Open WebUI connected to host Ollama.

## Routing and governance

- `src/core/policy.ts`: policy interface and default restricted-data local-only rule.
- `src/core/decision.ts`: eligibility filter and `RuleDecisionEngine`.
- `src/core/registry.ts`: logical model registry.
- `src/core/provider.ts`: provider interface and provider registry.

## Execution extensions

- `src/core/telemetry.ts`: trace event contract, memory sink, cost estimation.
- `src/core/tools.ts`: model-agnostic tool contract, registry, and authorization executor.
- `src/providers/http-local.ts`: generic local `/generate` adapter.

## Repository intelligence

- `harness/indexer.py`: scan, ignore rules, symbols, imports, cache.
- `harness/search.py`: code, file, symbol, reference, and dependent lookup.
- `harness/context.py`: targeted, budgeted context assembly.
- `harness/tools.py`: read, Git, command, and test operations.
- `harness/cli.py`: index, refresh, context, search, and symbol commands.
