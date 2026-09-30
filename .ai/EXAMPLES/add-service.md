# Add provider-backed capability

Files inspected:

- `src/core/provider.ts` and `src/core/types.ts`.
- `src/core/registry.ts` and `src/core/harness.ts`.
- `src/core/telemetry.ts`.

Files modified:

- `src/providers/<provider>.ts` for translation and network behavior.
- Registration/configuration code for the logical model.
- Tests using a fake server or fake provider.

Reasoning path:

1. Define no new application-facing provider shape.
2. Implement `ModelProvider.generate()` and map output/usage to `ModelResult`.
3. Register a logical model with measured capabilities.
4. Ensure the model is excluded when requirements cannot be met.

Validation: `npm run build`, then provider and routing tests.
