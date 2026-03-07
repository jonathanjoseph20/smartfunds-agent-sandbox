import { dayRange, monthRange, type AuditLogEntry, type AuditSpendSnapshot, type AuditStore } from "../audit.js";
import type { LlmRouteClass } from "../types.js";

export class FakeAuditStore implements AuditStore {
  private readonly entries: AuditLogEntry[] = [];
  private failWrites = false;

  setWriteFailure(enabled: boolean): void {
    this.failWrites = enabled;
  }

  write(entry: AuditLogEntry): void {
    if (this.failWrites) {
      throw new Error("fake audit write failed");
    }
    this.entries.push({ ...entry });
  }

  getSpendSnapshot(routeClass: LlmRouteClass, nowIso: string): AuditSpendSnapshot {
    const daily = dayRange(nowIso);
    const monthly = monthRange(nowIso);

    const inDaily = this.entries.filter((entry) => entry.createdAt >= daily.start && entry.createdAt < daily.end);
    const inMonthly = this.entries.filter((entry) => entry.createdAt >= monthly.start && entry.createdAt < monthly.end);
    const routeDaily = inDaily.filter((entry) => entry.routeClass === routeClass);

    const sum = (items: AuditLogEntry[]): number => items.reduce((acc, entry) => acc + Number(entry.estimatedCostUsd ?? 0), 0);

    return {
      globalDailySpentUsd: sum(inDaily),
      globalMonthlySpentUsd: sum(inMonthly),
      routeDailySpentUsd: sum(routeDaily)
    };
  }

  listEntries(): AuditLogEntry[] {
    return this.entries.map((entry) => ({ ...entry }));
  }
}
