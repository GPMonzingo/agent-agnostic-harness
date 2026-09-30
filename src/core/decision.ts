import type { HarnessRequest, RegisteredModel, RouteDecision } from "./types.js";
import type { PolicyEngine } from "./policy.js";
export interface DecisionEngine { decide(request: HarnessRequest, models: RegisteredModel[]): Promise<RouteDecision>; }
export function eligibleModels(request: HarnessRequest, models: RegisteredModel[], policy: PolicyEngine): RegisteredModel[] {
  return policy.filter(request, models).filter(model => {
    const r = request.requirements; const c = model.capabilities;
    return (!r?.requiresVision || c.vision) && (!r?.requiresTools || c.tools) && (!r?.requiresStructuredOutput || c.structuredOutput) && (!r?.minimumContextWindow || c.contextWindow >= r.minimumContextWindow);
  });
}
export class RuleDecisionEngine implements DecisionEngine {
  constructor(private readonly policy: PolicyEngine) {}
  async decide(request: HarnessRequest, models: RegisteredModel[]): Promise<RouteDecision> {
    const eligible = eligibleModels(request, models, this.policy); if (!eligible.length) throw new Error("No eligible model satisfies request requirements");
    const preferred = request.requirements?.privacy === "restricted" ? eligible.find(m => m.capabilities.local) : request.task ? eligible.find(m => m.quality?.[request.task!] !== undefined) : undefined;
    const selected = preferred ?? eligible[0];
    return { modelId: selected.id, reason: preferred ? "Matched task or privacy policy" : "First eligible registered model", decisionEngine: "rules-v1", fallbackModels: eligible.filter(m => m.id !== selected.id).map(m => m.id) };
  }
}
