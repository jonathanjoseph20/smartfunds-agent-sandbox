import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { buildIssuanceIntent, computeIssuanceId, ISSUANCE_PLAN_HASH_V1 } from '../issuance-intent.ts';

describe('issuance intent', () => {
  it('computes deterministic issuance_id from subscriptionId + receiptId (T-I1)', () => {
    const first = computeIssuanceId('sub_001', 'receipt_001');
    const second = computeIssuanceId('sub_001', 'receipt_001');

    expect(first).toBe(second);
  });

  it('excludes created_at metadata from issuance identity hash (T-I2)', () => {
    const first = buildIssuanceIntent({
      subscriptionId: 'sub_001',
      receiptId: 'receipt_001',
      createdAt: '2026-02-28T00:00:00.000Z'
    });

    const second = buildIssuanceIntent({
      subscriptionId: 'sub_001',
      receiptId: 'receipt_001',
      createdAt: '2026-03-01T00:00:00.000Z'
    });

    expect(first.issuance_id).toBe(second.issuance_id);
  });

  it('uses deterministic issuance plan hash constant (T-I3)', () => {
    const intent = buildIssuanceIntent({
      subscriptionId: 'sub_001',
      receiptId: 'receipt_001',
      createdAt: '2026-02-28T00:00:00.000Z'
    });

    expect(intent.issuance_plan_hash).toBe(ISSUANCE_PLAN_HASH_V1);
    expect(canonicalStringify(intent)).toMatchInlineSnapshot(
      `"{"created_at":"2026-02-28T00:00:00.000Z","issuance_id":"a089f8188effaa023f7c44dfb704e5aba536b6106c1f5aed4574a2771f9ffe88","issuance_plan_hash":"b8d471276b4e556d9097226df994d22324c54d128abe531e015fcdd19f2ec62e","receipt_id":"receipt_001","status":"pending","subscription_id":"sub_001"}"`
    );
  });
});
