import type { ChargeIntent } from '../charge-intent.ts';
import { buildReceiptRef, buildSettlementResult, type SettlementAdapter } from './types.ts';

export const StripeMockAdapter: SettlementAdapter = {
  adapterId: 'stripe_mock',
  execute(intent: ChargeIntent) {
    const receiptRef = buildReceiptRef(intent.determinismHash, 'stripe_mock');
    if (intent.currency !== 'USD') {
      return buildSettlementResult({
        adapterId: 'stripe_mock',
        intentId: intent.intentId,
        outcome: 'FAILED',
        receiptRef,
        errorCode: 'ERR_STRIPE_MOCK_UNSUPPORTED_CURRENCY',
        errorMessage: 'Stripe mock supports USD only.'
      });
    }

    return buildSettlementResult({
      adapterId: 'stripe_mock',
      intentId: intent.intentId,
      outcome: 'EXECUTED',
      receiptRef
    });
  }
};
