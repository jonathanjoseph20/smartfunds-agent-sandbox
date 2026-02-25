import type { SettlementAdapter, SettlementAdapterId } from './types.ts';

const registry = new Map<SettlementAdapterId, SettlementAdapter>();

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== 'object') {
    return value;
  }
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
  } else {
    for (const key of Object.keys(value)) {
      const record = value as Record<string, unknown>;
      deepFreeze(record[key]);
    }
  }
  return value;
}

export function registerAdapter(adapter: SettlementAdapter): void {
  if (registry.has(adapter.adapterId)) {
    throw new Error(`ERR_ADAPTER_DUPLICATE_ID: ${adapter.adapterId}`);
  }
  registry.set(adapter.adapterId, deepFreeze(adapter));
}

export function resolveAdapter(adapterId: SettlementAdapterId): SettlementAdapter {
  const adapter = registry.get(adapterId);
  if (!adapter) {
    throw new Error(`ERR_ADAPTER_NOT_FOUND: ${adapterId}`);
  }
  return adapter;
}

export function listAdapters(): SettlementAdapter[] {
  return Array.from(registry.values()).sort((a, b) => a.adapterId.localeCompare(b.adapterId));
}

export function clearAdapterRegistryForTests(): void {
  registry.clear();
}
