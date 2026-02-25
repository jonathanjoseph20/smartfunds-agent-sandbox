import type { SwarmMode } from '../../swarm/types.ts';
import type { SettlementAdapter } from './types.ts';

export function assertAdapterAllowedForMode(adapter: SettlementAdapter, mode: SwarmMode): void {
  if (!adapter.allowedModes.includes(mode)) {
    throw new Error(`ERR_ADAPTER_MODE_FORBIDDEN: ${adapter.adapterId}`);
  }
}
