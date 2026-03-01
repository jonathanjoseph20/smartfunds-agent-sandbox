import { describe, expect, it } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import {
  buildPaymentReceipt,
  buildPaymentReceiptIdentity,
  computeReceiptId
} from '../payment-receipt.ts';
import type { ReceiptInput } from '../types.ts';

const BASE_INPUT: ReceiptInput = {
  subscriptionId: 'sub_001',
  dealId: 'deal_001',
  entityId: 'entity_001',
  railType: 'evm_usdc',
  amount: '1000.00',
  currency: 'USDC',
  payerRef: '0xabc',
  receiptRef: 'rcpt_001',
  toAccountRef: 'acct_001',
  chainId: 1
};

describe('payment receipt', () => {
  it('computes deterministic receipt_id from canonical identity fields (T-R1)', () => {
    const first = computeReceiptId(BASE_INPUT);
    const second = computeReceiptId({ ...BASE_INPUT });

    expect(first).toBe(second);
  });

  it('excludes metadata from receipt identity hash (T-R2)', () => {
    const first = buildPaymentReceipt(BASE_INPUT, {
      observedAt: '2026-02-28T00:00:00.000Z',
      sourceEventId: 'event_a'
    });

    const second = buildPaymentReceipt(BASE_INPUT, {
      observedAt: '2026-03-01T00:00:00.000Z',
      sourceEventId: 'event_b'
    });

    expect(first.receipt_id).toBe(second.receipt_id);
  });

  it('produces stable canonical identity snapshot (T-R3)', () => {
    expect(canonicalStringify(buildPaymentReceiptIdentity(BASE_INPUT))).toMatchInlineSnapshot(
      `"{"amount":"1000.00","chainId":1,"currency":"USDC","dealId":"deal_001","entityId":"entity_001","payerRef":"0xabc","railType":"evm_usdc","receiptRef":"rcpt_001","subscriptionId":"sub_001","toAccountRef":"acct_001"}"`
    );
  });
});
