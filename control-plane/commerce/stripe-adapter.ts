import type { ChargeIntent, PaymentReceiptClass } from './charge-intent-types.ts';

export type StripeAdapterResult = {
  receiptClass: PaymentReceiptClass;
  reasonTokens: string[];
};

export function evaluateStripeReceiptClass(intent: ChargeIntent): StripeAdapterResult {
  if (intent.currency !== 'USD' && intent.currency !== 'USDC') {
    return {
      receiptClass: 'payment_blocked',
      reasonTokens: ['stripe_currency_unsupported'],
    };
  }

  if (intent.amount === '0.00') {
    return {
      receiptClass: 'payment_received',
      reasonTokens: ['zero_amount_auto_settled'],
    };
  }

  return {
    receiptClass: 'payment_pending',
    reasonTokens: ['stripe_pending_capture'],
  };
}
