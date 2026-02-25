import { describe, expect, it } from 'vitest';

import { assertAdapterAllowedForMode } from './policy.ts';
import type { SettlementAdapter } from './types.ts';

const structuredOnly: SettlementAdapter = {
  adapterId: 'stripe_mock',
  allowedModes: ['structured'],
  execute: (intent) => ({
    adapterId: 'stripe_mock',
    intentId: intent.intentId,
    outcome: 'EXECUTED',
    receiptRef: 'rcpt_test',
    resultHash: 'hash'
  })
};

describe('adapter mode policy', () => {
  it('permits structured when allowed', () => {
    expect(() => assertAdapterAllowedForMode(structuredOnly, 'structured')).not.toThrow();
  });

  it('rejects autonomous when forbidden', () => {
    expect(() => assertAdapterAllowedForMode(structuredOnly, 'autonomous')).toThrow(
      /ERR_ADAPTER_MODE_FORBIDDEN/
    );
  });
});
