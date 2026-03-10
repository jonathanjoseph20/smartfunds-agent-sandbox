import { createSignalStore, type SignalStore } from './signal-store.ts';

export function createSignalInspection(options: { rootDir?: string; store?: SignalStore } = {}) {
  const store = options.store ?? createSignalStore({ rootDir: options.rootDir });

  function listRecent(input: { limit?: number } = {}): Array<{
    signalType: string;
    sourceMission: string;
    dataset: string;
    artifactReference?: string;
    slot: string;
    logDate: string;
  }> {
    return store.listSignals({ limit: input.limit }).map((entry) => ({
      signalType: entry.signalType,
      sourceMission: entry.sourceMission,
      dataset: entry.dataset,
      ...(entry.artifactReference ? { artifactReference: entry.artifactReference } : {}),
      slot: entry.slot,
      logDate: entry.logDate
    }));
  }

  function inspectSignalType(signalType: string) {
    return store.listSignals({ signalType });
  }

  function historyByDate() {
    return store.listHistory();
  }

  return {
    listRecent,
    inspectSignalType,
    historyByDate
  };
}

export type SignalInspection = ReturnType<typeof createSignalInspection>;
