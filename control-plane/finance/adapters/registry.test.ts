import { beforeEach, describe, expect, it } from 'vitest';

import { clearAdapterRegistryForTests, listAdapters, registerAdapter, resolveAdapter } from './registry.ts';
import type { SettlementAdapter } from './types.ts';

const adapterA: SettlementAdapter = {
  adapterId: 'stripe_mock',
  allowedModes: ['structured'],
  execute: (intent) => ({
    adapterId: 'stripe_mock',
    intentId: intent.intentId,
    outcome: 'EXECUTED',
    receiptRef: 'rcpt_test',
    resultHash: 'hash-a'
  })
};

const adapterB: SettlementAdapter = {
  adapterId: 'onchain_mock',
  allowedModes: ['autonomous'],
  execute: (intent) => ({
    adapterId: 'onchain_mock',
    intentId: intent.intentId,
    outcome: 'EXECUTED',
    receiptRef: 'rcpt_test',
    resultHash: 'hash-b'
  })
};

beforeEach(() => {
  clearAdapterRegistryForTests();
});

describe('adapter registry', () => {
  it('registers and resolves deterministically', () => {
    registerAdapter(adapterA);
    registerAdapter(adapterB);

    const resolved = resolveAdapter('stripe_mock');
    expect(resolved.adapterId).toBe('stripe_mock');
  });

  it('rejects duplicate adapter ids', () => {
    registerAdapter(adapterA);
    expect(() => registerAdapter(adapterA)).toThrow(/ERR_ADAPTER_DUPLICATE_ID/);
  });

  it('lists adapters in stable order', () => {
    registerAdapter(adapterB);
    registerAdapter(adapterA);

    const list = listAdapters();
    expect(list.map((adapter) => adapter.adapterId)).toEqual(['onchain_mock', 'stripe_mock']);
  });
});
