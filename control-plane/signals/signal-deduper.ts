import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { SignalRecord } from './signal-types.ts';
import type { SignalStore } from './signal-store.ts';

export function computeSignalDedupeKey(input: { signalType: string; dataset: string; slot: string }): string {
  const canonical = canonicalStringify({
    dataset: input.dataset,
    signalType: input.signalType,
    slot: input.slot
  });

  return sha256(canonical);
}

export function createSignalDeduper(store: SignalStore) {
  function isDuplicate(signal: SignalRecord): boolean {
    return store.hasDedupeKey(signal.dedupeKey);
  }

  return {
    isDuplicate
  };
}

export type SignalDeduper = ReturnType<typeof createSignalDeduper>;
