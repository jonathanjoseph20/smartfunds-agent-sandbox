import { createTriggerRegistry, type TriggerRegistry } from './trigger-registry.ts';
import { createTriggerStore, type TriggerStore } from './trigger-store.ts';

export function createTriggerInspection(options: {
  definitionsDir?: string;
  rootDir?: string;
  registry?: TriggerRegistry;
  store?: TriggerStore;
} = {}) {
  const registry = options.registry ?? createTriggerRegistry({ definitionsDir: options.definitionsDir });
  const store = options.store ?? createTriggerStore({ rootDir: options.rootDir });

  function listTriggers() {
    return registry.listTriggers();
  }

  function inspectTrigger(triggerId: string) {
    return registry.getTrigger(triggerId);
  }

  function historyByDate() {
    return store.listHistory();
  }

  return {
    listTriggers,
    inspectTrigger,
    historyByDate
  };
}

export type TriggerInspection = ReturnType<typeof createTriggerInspection>;
