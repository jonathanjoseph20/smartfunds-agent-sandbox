import type { ChargeIntent } from '../charge-intent.ts';
import { buildReceiptRef, buildSettlementResult, type SettlementAdapter } from './types.ts';

const ONCHAIN_COUNTERPARTY = /^0x[a-fA-F0-9]{40}$/;

export const OnchainMockAdapter: SettlementAdapter = {
  adapterId: 'onchain_mock',
  execute(intent: ChargeIntent) {
    const receiptRef = buildReceiptRef(intent.determinismHash, 'onchain_mock');
    if (intent.currency !== 'USDC') {
      return buildSettlementResult({
        adapterId: 'onchain_mock',
        intentId: intent.intentId,
        outcome: 'FAILED',
        receiptRef,
        errorCode: 'ERR_ONCHAIN_MOCK_UNSUPPORTED_CURRENCY',
        errorMessage: 'Onchain mock supports USDC only.'
      });
    }

    if (!ONCHAIN_COUNTERPARTY.test(intent.counterparty)) {
      return buildSettlementResult({
        adapterId: 'onchain_mock',
        intentId: intent.intentId,
        outcome: 'FAILED',
        receiptRef,
        errorCode: 'ERR_ONCHAIN_MOCK_INVALID_COUNTERPARTY',
        errorMessage: 'Onchain mock requires a 0x-prefixed 40-byte address.'
      });
    }

    return buildSettlementResult({
      adapterId: 'onchain_mock',
      intentId: intent.intentId,
      outcome: 'EXECUTED',
      receiptRef
    });
  }
};
