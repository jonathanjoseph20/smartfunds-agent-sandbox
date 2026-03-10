import path from 'node:path';

import type { SignalRecord } from '../signals/signal-types.ts';

import { createTriggerDeduper, type TriggerDeduper } from './trigger-deduper.ts';
import { createTriggerRegistry, type TriggerRegistry } from './trigger-registry.ts';
import { createTriggerStore, type TriggerStore } from './trigger-store.ts';
import type { EvaluateSignalForTriggersResult, MissionLaunchRequest } from './trigger-types.ts';

export function createTriggerEngine(options: {
  definitionsDir?: string;
  triggersRootDir?: string;
  registry?: TriggerRegistry;
  store?: TriggerStore;
  deduper?: TriggerDeduper;
} = {}) {
  const registry = options.registry ?? createTriggerRegistry({ definitionsDir: options.definitionsDir });
  const store = options.store ?? createTriggerStore({ rootDir: options.triggersRootDir });
  const deduper = options.deduper ?? createTriggerDeduper(store);

  function evaluateSignalForTriggers(signal: SignalRecord): EvaluateSignalForTriggersResult {
    const triggers = registry.getTriggersForSignal(signal.signalType);

    if (triggers.length === 0) {
      return {
        status: 'no_match',
        launchRequests: []
      };
    }

    const launchRequests: MissionLaunchRequest[] = [];

    for (const trigger of triggers) {
      if (deduper.isDuplicateTrigger(trigger.triggerId, signal.dedupeKey, signal.slot)) {
        continue;
      }

      const launchRequest: MissionLaunchRequest = {
        missionId: trigger.mission,
        triggerId: trigger.triggerId,
        sourceSignal: signal.dedupeKey
      };

      const persisted = store.appendTrigger({
        logDate: signal.logDate,
        record: {
          triggerId: trigger.triggerId,
          signalReference: signal.dedupeKey,
          missionLaunched: trigger.mission,
          slot: signal.slot
        }
      });

      if (persisted.appended) {
        launchRequests.push(launchRequest);
      }
    }

    if (launchRequests.length > 0) {
      return {
        status: 'triggered',
        launchRequests
      };
    }

    return {
      status: 'duplicate',
      launchRequests: []
    };
  }

  return {
    evaluateSignalForTriggers,
    listTriggers: registry.listTriggers,
    getTrigger: registry.getTrigger,
    listHistory: store.listHistory,
    triggersRootDir: path.resolve(options.triggersRootDir ?? 'triggers')
  };
}

export type TriggerEngine = ReturnType<typeof createTriggerEngine>;
