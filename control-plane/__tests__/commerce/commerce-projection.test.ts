import { describe, expect, it } from 'vitest';

import { projectCommerce } from '../../commerce/commerce-projection.ts';
import type { ChargeIntent, PaymentReceipt } from '../../commerce/charge-intent-types.ts';

function baseIntent(): ChargeIntent {
  return {
    chargeIntentId: 'ci-1',
    buildEvidenceBundleId: 'be-1',
    runId: 'run-1',
    packetId: 'packet-1',
    bundleId: 'bundle-1',
    graphId: 'graph-1',
    taskId: 'task-1',
    planId: 'plan-1',
    productSpecId: 'spec-1',
    monetizationClass: 'artifact_delivery',
    amount: '99.00',
    currency: 'USD',
    payTo: 'smartfunds',
    railClasses: ['stripe', 'evm_wallet'],
    status: 'draft',
    outcome: 'pending_settlement',
  };
}

function manualReceipt(receiptClass: PaymentReceipt['receiptClass']): PaymentReceipt {
  return {
    paymentReceiptId: `manual-${receiptClass}`,
    chargeIntentId: 'ci-1',
    railBindingId: 'rb-1',
    receiptClass,
    receiptReference: receiptClass,
    reasonTokens: [],
    state: receiptClass === 'payment_failed' ? 'failed' : 'active',
  };
}

describe('commerce projection', () => {
  it('T-PF8-PRJ1 deterministic replay', () => {
    const input = {
      chargeIntent: baseIntent(),
      manualPaymentReceipts: [],
      history: [],
    };

    expect(projectCommerce(input)).toEqual(projectCommerce(input));
  });

  it('T-PF8-PRJ2 consistent status derivation', () => {
    const fulfilled = projectCommerce({
      chargeIntent: { ...baseIntent(), railClasses: ['stripe'] },
      manualPaymentReceipts: [manualReceipt('payment_received')],
      history: [],
    });

    const failed = projectCommerce({
      chargeIntent: baseIntent(),
      manualPaymentReceipts: [manualReceipt('payment_failed')],
      history: [],
    });

    expect(fulfilled.status).toBe('fulfilled');
    expect(failed.status).toBe('failed');
  });

  it('T-PF8-PRJ3 consistent outcome derivation', () => {
    const settled = projectCommerce({
      chargeIntent: { ...baseIntent(), railClasses: ['stripe'] },
      manualPaymentReceipts: [manualReceipt('payment_received')],
      history: [],
    });

    const inconclusive = projectCommerce({
      chargeIntent: { ...baseIntent(), currency: 'XYZ' },
      manualPaymentReceipts: [],
      history: [],
    });

    expect(settled.outcome).toBe('settled');
    expect(['inconclusive', 'blocked', 'pending_settlement']).toContain(inconclusive.outcome);
  });
});
