import { describe, expect, it } from 'vitest';

import { createSettlementLogStore } from './settlement-log.ts';
import type { SettlementResult } from './adapters/types.ts';

const result: SettlementResult = {
  adapterId: 'stripe_mock',
  intentId: 'ci_test',
  outcome: 'EXECUTED',
  receiptRef: 'rcpt_aaaaaaaaaaaa_stripe_mock',
  resultHash: 'hash-1'
};

describe('settlement log', () => {
  it('assigns deterministic entryIds per intent hash', () => {
    const log = createSettlementLogStore();

    const first = log.appendFromResult('a'.repeat(64), result);
    const second = log.appendFromResult('a'.repeat(64), { ...result, resultHash: 'hash-2' });

    expect(first.entryId).toBe('sl_aaaaaaaaaaaa_001');
    expect(second.entryId).toBe('sl_aaaaaaaaaaaa_002');
  });

  it('lists entries in stable order', () => {
    const log = createSettlementLogStore();
    log.appendFromResult('b'.repeat(64), { ...result, resultHash: 'hash-1' });
    log.appendFromResult('b'.repeat(64), { ...result, resultHash: 'hash-2' });

    const entries = log.listByIntentHash('b'.repeat(64));
    expect(entries.map((entry) => entry.entryId)).toEqual(['sl_bbbbbbbbbbbb_001', 'sl_bbbbbbbbbbbb_002']);
  });
});
