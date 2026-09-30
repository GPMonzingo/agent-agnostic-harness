# Add API endpoint

There is currently no HTTP server or Fastify route in this repository. If an API is added, keep it as a thin transport layer:

1. Parse and validate the incoming request.
2. Construct a `HarnessRequest`.
3. Call `Harness.execute()`.
4. Return the normalized `HarnessResponse`.
5. Never expose provider SDK response types or bypass policy/tool authorization.

Add integration tests proving the same response shape for local and hosted adapters.
