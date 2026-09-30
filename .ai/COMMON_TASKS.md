# Common Tasks

## Add a local model

1. Identify the model server protocol and response shape.
2. Add an adapter under `src/providers/` implementing `ModelProvider`.
3. Keep HTTP/auth/request translation inside the adapter.
4. Register the provider by stable logical name.
5. Register each model with accurate context window, locality, tools, vision, structured-output, and cost capabilities.
6. Add a fallback model only when it satisfies the same request requirements.
7. Add tests for successful output and normalized provider failure.
8. Run `npm run build`.

## Start Open WebUI with Ollama

1. Start Ollama on the host and verify `http://127.0.0.1:11434` responds.
2. Pull or register the model through Ollama; keep its storage outside this repository.
3. Run `docker compose up -d open-webui`.
4. Open `http://localhost:3000`.
5. Keep the harness model alias and capabilities in `config/local-models.json`.
6. Use `docker compose logs -f open-webui` if the UI cannot reach Ollama.

## Register a model

1. Create a `RegisteredModel` with a logical `id`.
2. Set `provider` to the registered provider name and `providerModel` to the server-specific model name.
3. Use measured quality values only as optional routing hints; never use them to bypass capability or policy filters.
4. Verify restricted requests select only models with `capabilities.local === true`.

## Change routing or policy

1. Read `src/core/policy.ts` and `src/core/decision.ts`.
2. Preserve hard capability filtering before scoring or preference selection.
3. Add tests for eligible and ineligible models, especially restricted, vision, tools, structured output, and context-window requirements.
4. Keep the decision reason explicit and stable enough for telemetry.

## Add a tool

1. Implement `HarnessTool` with a name, description, input schema, and async executor.
2. Register it in `ToolRegistry`.
3. Execute only through `ToolExecutor` with an explicitly authorized `ToolContext`.
4. Keep tool authorization independent from model selection.
5. Add idempotency and validation before any external side effect.

## Add repository context

1. Run `ai-harness refresh`.
2. Inspect with `ai-harness context "<task>"` before changing code.
3. Use `ai-harness symbol NAME`, `search`, and source-range reads to narrow discovery.
4. Modify the minimum relevant files and update `.ai` knowledge only when architecture/workflows change.

## Fix a provider failure

1. Check telemetry for selected model, provider, retries, fallback, latency, and error.
2. Confirm the provider adapter normalizes non-2xx responses.
3. Confirm fallback models were capability-eligible.
4. Test timeout/retry/fallback behavior without real network dependencies.
