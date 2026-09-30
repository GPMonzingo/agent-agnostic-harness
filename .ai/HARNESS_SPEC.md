# Harness Specification Alignment

The attached `model_agnostic_harness_step_by_step.pdf` is the design source for the TypeScript execution harness. It requires provider-neutral request/response contracts, capability-aware model and provider registries, policy filtering before routing, deterministic decision engines, model routing with retries/timeouts/fallbacks, telemetry/cost tracking, and independently authorized tools.

The existing Python repository-intelligence layer remains responsible for targeted repository context. The TypeScript harness consumes that context through ordinary `HarnessMessage` values and does not depend on a model vendor.

Implemented in `src/`: contracts, registries, policy engine, capability filter, rule decision engine, router, timeout/retry/fallback lifecycle, telemetry, tool registry/executor, and a generic local HTTP adapter. Future free local models should be added as adapters or configured behind `HttpLocalProvider`; application code should call `Harness.execute()`.

## Agent operating rules

Before editing a repository task, the coding model should:

1. Read `.ai/repo-context.json`, `REPO_MAP.md`, `ARCHITECTURE.md`, `CODING_RULES.md`, and `TESTING.md`.
2. Run the context inspector for the user request.
3. Search symbols and references before broad file reads.
4. Treat logical model IDs, provider names, and tool names as registered configuration—not hard-coded assumptions.
5. Preserve policy and capability gates even when a model requests a shortcut.
6. Modify the smallest necessary set of files.
7. Run the validation commands that apply and report unavailable commands honestly.
