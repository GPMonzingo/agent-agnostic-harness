# Fix bug

## Example: local provider returns an empty response

Files inspected:

- `src/providers/http-local.ts` for response-shape translation.
- `src/core/provider.ts` for the provider contract.
- `src/core/harness.ts` for normalized execution behavior.
- `.ai/TESTING.md` for validation.

Files modified:

- The adapter only, unless the provider contract is genuinely incomplete.

Reasoning path:

1. Reproduce with a fake response matching the local server payload.
2. Preserve the common `ModelResult.output` shape.
3. Normalize non-2xx responses to an `Error`.
4. Do not add provider-specific fields to `HarnessResponse`.

Validation:

```text
npm run build
provider adapter unit tests
```
