import { describe, expect, it } from 'vitest';

import { createManualPaymentReceipt, derivePaymentReceiptsFromEligibility } from '../../commerce/payment-receipt.ts';
import type { RailEligibility } from '../../commerce/charge-intent-types.ts';

function eligibility(status: RailEligibility['eligibilityStatus'], railBindingId: string): RailEligibility {
  return {
    railEligibilityId: `re-${status}-${railBindingId}`,
    chargeIntentId: 'ci-1',
    railBindingId,
    eligibilityStatus: status,
    reasonTokens: [],
    blockingConditionTokens: [],
    state: 'active',
  };
}

describe('payment receipt', () => {
  it('T-PF8-PR1 supports derived classes and manual classes', () => {
    const receipts = derivePaymentReceiptsFromEligibility({
      chargeIntentId: 'ci-1',
      railEligibility: [
        eligibility('eligible', 'rb-1'),
        eligibility('blocked', 'rb-2'),
        eligibility('incompatible', 'rb-3'),
        eligibility('inconclusive', 'rb-4'),
      ],
    });

    const classes = receipts.map((entry) => entry.receiptClass);
    expect(classes).toContain('payment_pending');
    expect(classes).toContain('payment_blocked');
    expect(classes).toContain('payment_inconclusive');

    const received = createManualPaymentReceipt({
      chargeIntentId: 'ci-1',
      railBindingId: 'rb-1',
      receiptClass: 'payment_received',
      receiptReference: 'manual-1',
    });
    const failed = createManualPaymentReceipt({
      chargeIntentId: 'ci-1',
      railBindingId: 'rb-1',
      receiptClass: 'payment_failed',
      receiptReference: 'manual-2',
    });

    expect(received.receiptClass).toBe('payment_received');
    expect(failed.receiptClass).toBe('payment_failed');
  });
});
