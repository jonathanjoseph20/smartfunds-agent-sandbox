import { canonicalStringify, sha256 } from '../finance/determinism.ts';

export type SwarmLogStatus = 'ok' | 'error';

export type SwarmLogEntry = {
  entryId: string;
  runId: string;
  stepIndex: number;
  roleId: string;
  outputHash: string;
  status: SwarmLogStatus;
};

const logStore = new Map<string, SwarmLogEntry[]>();

function buildEntryId(runId: string, stepIndex: number): string {
  return sha256(canonicalStringify({ runId, stepIndex }));
}

export function appendSwarmLog(entry: Omit<SwarmLogEntry, 'entryId'>): void {
  const entryId = buildEntryId(entry.runId, entry.stepIndex);
  const stored: SwarmLogEntry = { ...entry, entryId };
  const current = logStore.get(entry.runId) ?? [];
  current.push(stored);
  logStore.set(entry.runId, current);
}

export function getSwarmLog(runId: string): SwarmLogEntry[] {
  const entries = logStore.get(runId) ?? [];
  return [...entries].sort((a, b) => a.stepIndex - b.stepIndex);
}

export function clearSwarmLogForTests(): void {
  logStore.clear();
}
