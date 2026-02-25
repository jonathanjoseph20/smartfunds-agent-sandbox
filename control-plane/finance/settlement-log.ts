import type { SettlementAdapterId, SettlementOutcome, SettlementResult } from './adapters/types.ts';

export type SettlementLogEntry = {
  entryId: string;
  intentHash: string;
  adapterId: SettlementAdapterId;
  outcome: SettlementOutcome;
  receiptRef: string;
  resultHash: string;
};

export type SettlementLogStore = {
  append(entry: SettlementLogEntry): void;
  appendFromResult(intentHash: string, result: SettlementResult): SettlementLogEntry;
  listByIntentHash(intentHash: string): SettlementLogEntry[];
};

function buildEntryId(intentHash: string, attemptIndex: number): string {
  return `sl_${intentHash.slice(0, 12)}_${String(attemptIndex).padStart(3, '0')}`;
}

export function createSettlementLogStore(): SettlementLogStore {
  const entries: SettlementLogEntry[] = [];
  const attemptsByIntent = new Map<string, number>();

  function append(entry: SettlementLogEntry): void {
    entries.push(entry);
  }

  function appendFromResult(intentHash: string, result: SettlementResult): SettlementLogEntry {
    const current = attemptsByIntent.get(intentHash) ?? 0;
    const nextAttempt = current + 1;
    attemptsByIntent.set(intentHash, nextAttempt);
    const entry: SettlementLogEntry = {
      entryId: buildEntryId(intentHash, nextAttempt),
      intentHash,
      adapterId: result.adapterId,
      outcome: result.outcome,
      receiptRef: result.receiptRef,
      resultHash: result.resultHash
    };
    append(entry);
    return entry;
  }

  function listByIntentHash(intentHash: string): SettlementLogEntry[] {
    return entries
      .filter((entry) => entry.intentHash === intentHash)
      .slice()
      .sort((a, b) => a.entryId.localeCompare(b.entryId));
  }

  return { append, appendFromResult, listByIntentHash };
}
