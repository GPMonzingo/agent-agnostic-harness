# Coding Rules

## Languages and runtime

- TypeScript targets ES2022 with NodeNext modules, strict type checking, and `.js` import specifiers in source imports.
- Python targets 3.10+; the repository-intelligence core uses the standard library.
- Keep provider-specific SDK types and payloads inside `src/providers/` adapters.

## Architecture

- Application-facing code uses `HarnessRequest`, `HarnessResponse`, `ModelProvider`, `HarnessTool`, and related contracts.
- Keep policy, capability filtering, decision engines, registries, provider calls, telemetry, and tool authorization separate.
- Prefer logical model IDs (`local-coding`) over vendor model names in application code.
- Use deterministic routing and hard capability gates before any quality/cost scoring.
- Preserve local-first behavior for restricted data; never let model output override policy.

## Implementation

- Prefer small classes/functions with explicit interfaces and immutable constructor dependencies.
- Validate missing registry entries with clear errors.
- Normalize provider errors at the adapter boundary.
- Pass request IDs through traces and tool contexts for correlation.
- Keep retries limited and never add retries to side-effecting tools without idempotency.
- Pass `AbortSignal` to network adapters and honor latency requirements where possible.
- Keep telemetry free of full prompts, secrets, and sensitive source by default.

## Python indexer

- Respect `.gitignore` and `.aiignore` patterns plus built-in exclusions.
- Never automatically inject `.env`, keys, credentials, secrets, or binary/generated content.
- Bound snippets and source content in search/context results.
- Keep index output deterministic and refreshable; do not hand-edit `.ai/index.json`.

## Tests and completion

- Add a focused test for every routing, policy, fallback, provider, tool, or indexer behavior change.
- Run `npm run build` for TypeScript changes and `python -m pytest` for Python changes when runtimes are available.
- Review the diff and report unavailable validation explicitly.
