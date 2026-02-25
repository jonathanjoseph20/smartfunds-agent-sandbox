import type { ChargeIntent } from '../charge-intent.ts';
import { buildReceiptRef, buildSettlementResult, type SettlementAdapter } from './types.ts';

export const WireMockAdapter: SettlementAdapter = {
  adapterId: 'wire_mock',
  allowedModes: ['structured', 'autonomous'],
  execute(intent: ChargeIntent) {
    const receiptRef = buildReceiptRef(intent.determinismHash, 'wire_mock');
    if (!intent.counterparty.startsWith('wire:')) {
      return buildSettlementResult({
        adapterId: 'wire_mock',
        intentId: intent.intentId,
        outcome: 'FAILED',
        receiptRef,
        errorCode: 'ERR_WIRE_MOCK_INVALID_REFERENCE',
        errorMessage: 'Wire mock requires counterparty to start with wire:.'
      });
    }

    return buildSettlementResult({
      adapterId: 'wire_mock',
      intentId: intent.intentId,
      outcome: 'EXECUTED',
      receiptRef
    });
  }
};
