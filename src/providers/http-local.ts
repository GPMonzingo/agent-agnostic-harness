import type { HarnessRequest, ModelCapabilities, ModelResult } from "../core/types.js";
import type { ModelProvider } from "../core/provider.js";
export class HttpLocalProvider implements ModelProvider {
  readonly name: string; constructor(private readonly baseUrl: string, name = "local-http") { this.name = name; }
  supports(): boolean { return true; }
  capabilities(): ModelCapabilities { return { contextWindow: 32768, vision: false, tools: false, streaming: false, structuredOutput: false, local: true }; }
  async generate(request: HarnessRequest, model: string, signal?: AbortSignal): Promise<ModelResult> { const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, messages: request.messages, temperature: request.generation?.temperature, max_tokens: request.generation?.maxTokens }), signal }); if (!response.ok) throw new Error(`Local provider HTTP ${response.status}`); const body = await response.json() as { output?: string; response?: string; usage?: ModelResult["usage"] }; return { output: body.output ?? body.response ?? "", usage: body.usage, raw: body }; }
}
