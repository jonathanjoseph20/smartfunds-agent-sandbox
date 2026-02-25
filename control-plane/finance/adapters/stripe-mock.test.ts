import { describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../determinism.ts';
import type { ChargeIntent } from '../charge-intent.ts';
import { StripeMockAdapter } from './stripe-mock.ts';

const baseIntent: ChargeIntent = {
  intentId: 'ci_test',
  entityId: 'entity',
  railProfileId: 'hybrid',
  amount: '50.00',
  currency: 'USD',
  counterparty: 'customer-1',
  purpose: 'payment',
  status: 'CREATED',
  determinismHash: 'a'.repeat(64)
};

describe('StripeMockAdapter', () => {
  it('executes USD intents', () => {
    const result = StripeMockAdapter.execute(baseIntent);

    expect(result.outcome).toBe('EXECUTED');
    expect(result.receiptRef).toBe(`rcpt_${baseIntent.determinismHash.slice(0, 12)}_stripe_mock`);
    const expectedHash = sha256(
      canonicalStringify({
        adapterId: 'stripe_mock',
        intentId: baseIntent.intentId,
        outcome: 'EXECUTED',
        receiptRef: result.receiptRef
      })
    );
    expect(result.resultHash).toBe(expectedHash);
  });

  it('fails when currency is unsupported', () => {
    const result = StripeMockAdapter.execute({ ...baseIntent, currency: 'USDC' });

    expect(result.outcome).toBe('FAILED');
    expect(result.errorCode).toBe('ERR_STRIPE_MOCK_UNSUPPORTED_CURRENCY');
    expect(result.receiptRef).toBe(`rcpt_${baseIntent.determinismHash.slice(0, 12)}_stripe_mock`);
    const expectedHash = sha256(
      canonicalStringify({
        adapterId: 'stripe_mock',
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
