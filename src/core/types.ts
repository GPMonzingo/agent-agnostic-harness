export type TaskType = "chat" | "coding" | "reasoning" | "summarization" | "extraction" | "classification" | "vision" | "agent";
export type Privacy = "public" | "internal" | "restricted";
export type HarnessRole = "system" | "user" | "assistant" | "tool";

export interface HarnessMessage { role: HarnessRole; content: string; }
export interface ModelRequirements {
  maxLatencyMs?: number; maxCostUsd?: number; minimumContextWindow?: number;
  requiresTools?: boolean; requiresVision?: boolean; requiresStructuredOutput?: boolean;
  privacy?: Privacy;
}
export interface HarnessRequest {
  id: string; messages: HarnessMessage[]; task?: TaskType;
  requirements?: ModelRequirements; generation?: { temperature?: number; maxTokens?: number };
  metadata?: Record<string, unknown>;
}
export interface ModelCapabilities {
  contextWindow: number; vision: boolean; tools: boolean; streaming: boolean;
  structuredOutput: boolean; local: boolean; costPerMillionInputTokens?: number;
  costPerMillionOutputTokens?: number;
}
export interface RegisteredModel { id: string; provider: string; providerModel: string; capabilities: ModelCapabilities; quality?: Partial<Record<TaskType, number>>; }
export interface Usage { inputTokens?: number; outputTokens?: number; totalTokens?: number; }
export interface ModelResult { output: string; usage?: Usage; raw?: unknown; }
export interface RouteDecision { modelId: string; reason: string; confidence?: number; fallbackModels?: string[]; decisionEngine: string; }
export interface HarnessResponse { id: string; output: string; model: string; provider: string; usage?: Usage; cost?: { estimatedUsd?: number }; latencyMs: number; route: RouteDecision; }
