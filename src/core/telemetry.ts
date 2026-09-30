import type { HarnessRequest, HarnessResponse, RouteDecision, Usage } from "./types.js";
export interface TraceEvent { traceId: string; task?: string; route: { selectedModel: string; decisionEngine: string; reason: string }; usage?: Usage; performance: { routingMs: number; modelMs: number; totalMs: number }; cost?: { estimatedUsd: number }; result: { success: boolean; retries: number; fallback?: boolean; error?: string }; }
export interface TelemetrySink { record(event: TraceEvent): void; }
export class MemoryTelemetry implements TelemetrySink { readonly events: TraceEvent[] = []; record(event: TraceEvent): void { this.events.push(event); } }
export function estimateCost(usage: Usage | undefined, inputRate?: number, outputRate?: number): number { return ((usage?.inputTokens ?? 0) / 1_000_000) * (inputRate ?? 0) + ((usage?.outputTokens ?? 0) / 1_000_000) * (outputRate ?? 0); }
