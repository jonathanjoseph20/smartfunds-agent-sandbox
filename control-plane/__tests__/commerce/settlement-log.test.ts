import { describe, expect, it } from 'vitest';

import { deriveSettlementLogsFromReceipts } from '../../commerce/settlement-log.ts';
import type { PaymentReceipt } from '../../commerce/charge-intent-types.ts';

function receipt(receiptClass: PaymentReceipt['receiptClass'], id: string): PaymentReceipt {
  return {
    paymentReceiptId: `pr-${id}`,
    chargeIntentId: 'ci-1',
    railBindingId: `rb-${id}`,
    receiptClass,
    receiptReference: `r-${id}`,
    reasonTokens: [],
    state: 'active',
  };
}

describe('settlement log', () => {
  it('T-PF8-SL1 maps all receipt classes to settlement classes', () => {
    const logs = deriveSettlementLogsFromReceipts({
      chargeIntentId: 'ci-1',
      paymentReceipts: [
        receipt('payment_received', '1'),
        receipt('payment_pending', '2'),
        receipt('payment_failed', '3'),
        receipt('payment_blocked', '4'),
        receipt('payment_inconclusive', '5'),
      ],
    });

    const classes = logs.map((entry) => entry.settlementClass);
    expect(classes).toContain('settlement_completed');
    expect(classes).toContain('settlement_pending');
    expect(classes).toContain('settlement_failed');
    expect(classes).toContain('settlement_blocked');
    expect(classes).toContain('settlement_inconclusive');
  });
});
