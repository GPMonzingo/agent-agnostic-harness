# Local Coding Agent Instructions

You are working in a two-language, model-agnostic harness repository.

Before changing code:

1. Read `.ai/repo-context.json`, `REPO_MAP.md`, `ARCHITECTURE.md`, `CODING_RULES.md`, and `TESTING.md`.
2. Use `ai-harness context "<user request>"` to inspect targeted context.
3. Use `ai-harness symbol`, `search`, and `find_references` before broad reads.
4. Confirm whether the change belongs in the TypeScript execution harness (`src/`) or Python repository intelligence (`harness/`).

While changing code:

- Keep application interfaces provider-neutral.
- Do not hard-code a vendor model into core routing logic.
- Capability filtering and policy are hard gates; quality scores cannot override them.
- Keep provider translation inside `src/providers/`.
- Keep tool authorization independent from model selection.
- Treat restricted data as local-only unless an explicit policy change says otherwise.
- Do not automatically load sensitive files or entire repositories into context.
- Make the smallest coherent change and add focused tests.

Before reporting completion:

1. Run the applicable build/tests from `TESTING.md`.
2. Inspect failures rather than assuming they are unrelated.
3. Review the diff and generated files.
4. State exactly which validation commands ran and whether they passed.
5. Never claim a model call, test, or tool execution succeeded without observed evidence.
