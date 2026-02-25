import { describe, expect, it } from 'vitest';

import { canonicalStringify, sha256 } from '../determinism.ts';
import type { ChargeIntent } from '../charge-intent.ts';
import { OnchainMockAdapter } from './onchain-mock.ts';

const baseIntent: ChargeIntent = {
  intentId: 'ci_test',
  entityId: 'entity',
  railProfileId: 'hybrid',
  amount: '75.00',
  currency: 'USDC',
  counterparty: '0x1111111111111111111111111111111111111111',
  purpose: 'payment',
  status: 'CREATED',
  determinismHash: 'b'.repeat(64)
};

describe('OnchainMockAdapter', () => {
  it('executes USDC intents with valid counterparty', () => {
    const result = OnchainMockAdapter.execute(baseIntent);

    expect(result.outcome).toBe('EXECUTED');
    expect(result.receiptRef).toBe(`rcpt_${baseIntent.determinismHash.slice(0, 12)}_onchain_mock`);
    const expectedHash = sha256(
      canonicalStringify({
        adapterId: 'onchain_mock',
        intentId: baseIntent.intentId,
        outcome: 'EXECUTED',
        receiptRef: result.receiptRef
      })
    );
    expect(result.resultHash).toBe(expectedHash);
  });

  it('fails when currency is unsupported', () => {
    const result = OnchainMockAdapter.execute({ ...baseIntent, currency: 'USD' });

    expect(result.outcome).toBe('FAILED');
    expect(result.errorCode).toBe('ERR_ONCHAIN_MOCK_UNSUPPORTED_CURRENCY');
    const expectedHash = sha256(
      canonicalStringify({
        adapterId: 'onchain_mock',
        intentId: baseIntent.intentId,
        outcome: 'FAILED',
        receiptRef: result.receiptRef,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage
      })
    );
    expect(result.resultHash).toBe(expectedHash);
  });

  it('fails when counterparty is invalid', () => {
    const result = OnchainMockAdapter.execute({ ...baseIntent, counterparty: 'not-an-address' });

    expect(result.outcome).toBe('FAILED');
    expect(result.errorCode).toBe('ERR_ONCHAIN_MOCK_INVALID_COUNTERPARTY');
    const expectedHash = sha256(
      canonicalStringify({
        adapterId: 'onchain_mock',
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
