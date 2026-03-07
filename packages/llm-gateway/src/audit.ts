import type { LlmRouteClass } from "./types.js";

export interface AuditLogEntry {
  requestId: string;
  callerClass: string;
  routeClass: LlmRouteClass;
  provider: string;
  modelAlias: string;
  providerModel: string;
  promptId: string;
  promptVersion: string;
  status: "success" | "error";
  fallbackUsed: boolean;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  latencyMs?: number;
  errorCode?: string;
  createdAt: string;
}

export interface AuditSpendSnapshot {
  globalDailySpentUsd: number;
  globalMonthlySpentUsd: number;
  routeDailySpentUsd: number;
}

export interface AuditStore {
  write(entry: AuditLogEntry): void;
  getSpendSnapshot(routeClass: LlmRouteClass, nowIso: string): AuditSpendSnapshot;
  listEntries?(): AuditLogEntry[];
}

export function dayRange(nowIso: string): { start: string; end: string } {
  const now = new Date(nowIso);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function monthRange(nowIso: string): { start: string; end: string } {
  const now = new Date(nowIso);
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start: start.toISOString(), end: end.toISOString() };
}
