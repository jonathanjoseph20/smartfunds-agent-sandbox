import type { ChargeIntent, PaymentReceiptClass } from './charge-intent-types.ts';

export type EreborAdapterResult = {
  receiptClass: PaymentReceiptClass;
  reasonTokens: string[];
};

export function evaluateEreborReceiptClass(intent: ChargeIntent): EreborAdapterResult {
  const amount = Number.parseFloat(intent.amount);
  if (!Number.isFinite(amount)) {
    return {
      receiptClass: 'payment_inconclusive',
      reasonTokens: ['amount_parse_failure'],
    };
  }

  if (amount > 1000000) {
    return {
      receiptClass: 'payment_blocked',
      reasonTokens: ['erebor_limit_exceeded'],
    };
  }

  if (intent.currency !== 'USD') {
    return {
      receiptClass: 'payment_inconclusive',
      reasonTokens: ['erebor_manual_currency_review'],
    };
  }

  return {
    receiptClass: 'payment_pending',
    reasonTokens: ['erebor_settlement_window_open'],
  };
}
