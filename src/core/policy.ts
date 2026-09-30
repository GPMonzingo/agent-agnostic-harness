import type { HarnessRequest, RegisteredModel } from "./types.js";
export interface PolicyDecision { allowed: boolean; constraints?: { localOnly?: boolean; blockedProviders?: string[]; allowedTools?: string[]; redactPII?: boolean }; reason?: string; }
export interface PolicyEngine { evaluate(request: HarnessRequest): PolicyDecision; filter(request: HarnessRequest, models: RegisteredModel[]): RegisteredModel[]; }
export class DefaultPolicyEngine implements PolicyEngine {
  evaluate(request: HarnessRequest): PolicyDecision { return { allowed: true, constraints: request.requirements?.privacy === "restricted" ? { localOnly: true } : undefined }; }
  filter(request: HarnessRequest, models: RegisteredModel[]): RegisteredModel[] {
    const decision = this.evaluate(request); if (!decision.allowed) return [];
    return models.filter(model => !decision.constraints?.localOnly || model.capabilities.local).filter(model => !decision.constraints?.blockedProviders?.includes(model.provider));
  }
}
