# Architecture

This repository has two cooperating layers:

```text
Coding client
    |
    +--> Python repository intelligence
    |      scan -> symbol/import index -> search -> budgeted context
    |
    +--> TypeScript Harness.execute(HarnessRequest)
           policy -> capability filter -> decision engine -> provider adapter
                                                  |                 |
                                                  +--> telemetry <--+
           tool registry/executor is separate and authorization-gated
```

## Request flow

1. The client creates a provider-neutral `HarnessRequest` with an ID, messages, task, requirements, and generation settings.
2. `Harness` evaluates policy before routing. Restricted requests are local-only through `DefaultPolicyEngine`.
3. `RuleDecisionEngine` filters models by privacy and hard capabilities: vision, tools, structured output, and context window.
4. The selected logical model is resolved through `ModelRegistry`, then its provider through `ProviderRegistry`.
5. `Harness` invokes the adapter, applies timeout/retry behavior, and tries approved fallback model IDs after repeated failure.
6. The result is normalized to `HarnessResponse`; `TelemetrySink` receives route, latency, usage, cost estimate, retry, and fallback information.

## Repository context flow

`RepositoryIndex.scan()` reads supported source extensions while excluding dependency/build/sensitive paths. It extracts lightweight symbols and imports into a filesystem cache. `ContextBuilder` uses task text, symbol hits, code search, `.ai` knowledge, tests, and examples to create bounded structured context. It does not call an LLM.

## Boundaries

- Application code depends on harness contracts, not provider SDK/request shapes.
- Decision logic is in `decision.ts`; provider execution is in `provider.ts` and adapters.
- Policy is evaluated before selection; tool authorization is checked independently by `ToolExecutor`.
- MCP, HTTP, Ollama, llama.cpp, or another transport belongs in adapters; it is not the core architecture.
- Current persistence is filesystem-based metadata only. There is no database, HTTP API server, or background worker implemented.

## Actual limitations

`DefaultPolicyEngine` currently enforces local-only routing for restricted data but does not yet redact PII, authenticate callers, enforce cost budgets, or persist circuit-breaker state. `Harness.withTimeout` bounds the returned promise but adapters should honor the passed `AbortSignal` for true cancellation. Do not assume these features exist.
