# Testing

## Commands

| Area | Command | Status |
|---|---|---|
| TypeScript build/typecheck | `npm run build` | Configured in `package.json` |
| TypeScript tests | `npm test` | Script exists; requires compiled test files under `dist/tests` |
| Python unit tests | `python -m pytest` | Configured by `pyproject.toml` |
| Index refresh | `ai-harness refresh` | Python console script |
| Context inspection | `ai-harness context "sample task"` | Does not call a model |

## Test locations and conventions

- Python tests live in `tests/`, use `pytest`, and create temporary repositories with `tmp_path`.
- TypeScript test sources, when added, belong under `tests-ts/` so they compile into `dist/tests/`.
- Provider tests should use fake providers or local test servers; do not require cloud credentials or a running model.
- Routing tests should assert selected logical model ID, fallback order, and decision reason.
- Policy tests should prove restricted requests cannot select non-local models and unsupported capabilities are excluded.
- Tool tests should prove unauthorized names reject before executor code runs.
- Telemetry tests should assert trace ID, selected model, latency fields, usage, retries, and fallback markers.
- Index tests should assert `.env`/key exclusion, `.aiignore` behavior, symbols, imports, search, cache round trips, and bounded context.

## Minimum validation after changes

- Context/index changes: `python -m pytest`, then `ai-harness context "representative task"`.
- TypeScript core/provider changes: `npm run build` plus focused unit tests.
- Routing/policy/tool changes: build plus tests for both allowed and denied paths.
- Before completion: inspect the diff; never claim tests passed if the runtime or command was unavailable.
