# Dependencies

## Runtime dependencies

| Dependency | Version/source | Purpose | Convention |
|---|---|---|---|
| Node.js | ES2022 runtime | TypeScript harness execution and built-in `fetch` | Use provider-neutral contracts; no SDK is required by core |
| Python | 3.10+ | Repository indexing/context builder | Standard library core; no cloud calls |

## Development dependencies

| Dependency | Version/source | Purpose | Where used |
|---|---|---|---|
| TypeScript | `^5.7.0` | Strict TypeScript compilation | `npm run build` |
| pytest | environment-provided | Python tests | `python -m pytest` |

## Deliberately absent

There is no OpenAI/Anthropic/Gemini/Ollama SDK, web framework, database, vector database, cloud service, or MCP dependency in the core. A provider or transport adapter may add its own dependency later, but it must not leak into `src/core/` contracts.
