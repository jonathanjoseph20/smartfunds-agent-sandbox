import type { ChargeIntent, PaymentReceiptClass } from './charge-intent-types.ts';

export type EvmWalletAdapterResult = {
  receiptClass: PaymentReceiptClass;
  reasonTokens: string[];
};

export function evaluateEvmWalletReceiptClass(intent: ChargeIntent): EvmWalletAdapterResult {
  if (intent.currency === 'ETH' || intent.currency === 'USDC') {
    return {
      receiptClass: 'payment_pending',
      reasonTokens: ['onchain_confirmation_pending'],
    };
  }

  if (intent.currency === 'USD') {
    return {
      receiptClass: 'payment_inconclusive',
      reasonTokens: ['fiat_to_token_conversion_required'],
    };
  }

  return {
    receiptClass: 'payment_blocked',
    reasonTokens: ['evm_currency_unsupported'],
  };
}
