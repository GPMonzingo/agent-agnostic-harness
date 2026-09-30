import type { HarnessRequest, ModelCapabilities, ModelResult } from "./types.js";
export interface ModelProvider {
  readonly name: string;
  supports(model: string): boolean;
  capabilities(model: string): ModelCapabilities;
  generate(request: HarnessRequest, model: string, signal?: AbortSignal): Promise<ModelResult>;
}
export class ProviderRegistry {
  private readonly providers = new Map<string, ModelProvider>();
  register(provider: ModelProvider): void { this.providers.set(provider.name, provider); }
  get(name: string): ModelProvider { const provider = this.providers.get(name); if (!provider) throw new Error(`Provider not registered: ${name}`); return provider; }
}
