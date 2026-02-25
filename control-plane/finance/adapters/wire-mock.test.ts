import { describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../determinism.ts';
import type { ChargeIntent } from '../charge-intent.ts';
import { WireMockAdapter } from './wire-mock.ts';

const baseIntent: ChargeIntent = {
  intentId: 'ci_test',
  entityId: 'entity',
  railProfileId: 'hybrid',
  amount: '125.00',
  currency: 'USD',
  counterparty: 'wire:acct-1',
  purpose: 'payment',
  status: 'CREATED',
  determinismHash: 'c'.repeat(64)
};

describe('WireMockAdapter', () => {
  it('executes when counterparty uses wire prefix', () => {
    const result = WireMockAdapter.execute(baseIntent);

    expect(result.outcome).toBe('EXECUTED');
    expect(result.receiptRef).toBe(`rcpt_${baseIntent.determinismHash.slice(0, 12)}_wire_mock`);
    const expectedHash = sha256(
      canonicalStringify({
        adapterId: 'wire_mock',
        intentId: baseIntent.intentId,
        outcome: 'EXECUTED',
        receiptRef: result.receiptRef
      })
    );
    expect(result.resultHash).toBe(expectedHash);
  });

  it('fails when counterparty lacks wire prefix', () => {
    const result = WireMockAdapter.execute({ ...baseIntent, counterparty: 'acct-1' });

    expect(result.outcome).toBe('FAILED');
    expect(result.errorCode).toBe('ERR_WIRE_MOCK_INVALID_REFERENCE');
    const expectedHash = sha256(
      canonicalStringify({
        adapterId: 'wire_mock',
        intentId: baseIntent.intentId,
        outcome: 'FAILED',
        receiptRef: result.receiptRef,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
      })
    );
    expect(result.resultHash).toBe(expectedHash);
  });
});
