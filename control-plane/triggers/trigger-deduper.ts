import type { TriggerStore } from './trigger-store.ts';

export function createTriggerDeduper(store: TriggerStore) {
  function isDuplicateTrigger(triggerId: string, signalIdentity: string, slot: string): boolean {
    return store.hasTrigger({
      triggerId,
      signalReference: signalIdentity,
      slot
    });
  }

  return {
    isDuplicateTrigger
  };
}

export type TriggerDeduper = ReturnType<typeof createTriggerDeduper>;
