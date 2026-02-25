import { canonicalStringify, sha256 } from '../determinism.ts';
import type { ChargeIntent } from '../charge-intent.ts';

export type SettlementOutcome = 'EXECUTED' | 'FAILED';

export type SettlementAdapterId = 'stripe_mock' | 'onchain_mock' | 'wire_mock';

export type SettlementResult = {
  adapterId: SettlementAdapterId;
  intentId: string;
  outcome: SettlementOutcome;
  receiptRef: string;
  errorCode?: string;
  errorMessage?: string;
  resultHash: string;
};

export interface SettlementAdapter {
  adapterId: SettlementAdapterId;
  execute(intent: ChargeIntent): SettlementResult;
}

export function buildReceiptRef(intentHash: string, adapterId: SettlementAdapterId): string {
  return `rcpt_${intentHash.slice(0, 12)}_${adapterId}`;
}

export function buildSettlementResult(input: {
  adapterId: SettlementAdapterId;
  intentId: string;
  outcome: SettlementOutcome;
  receiptRef: string;
  errorCode?: string;
  errorMessage?: string;
}): SettlementResult {
  const resultCore: Record<string, string> = {
    adapterId: input.adapterId,
    intentId: input.intentId,
    outcome: input.outcome,
    receiptRef: input.receiptRef
  };

  if (input.errorCode) {
    resultCore.errorCode = input.errorCode;
  }
  if (input.errorMessage) {
    resultCore.errorMessage = input.errorMessage;
  }

  const resultHash = sha256(canonicalStringify(resultCore));

  return {
    adapterId: input.adapterId,
    intentId: input.intentId,
    outcome: input.outcome,
    receiptRef: input.receiptRef,
    ...(input.errorCode ? { errorCode: input.errorCode } : {}),
    ...(input.errorMessage ? { errorMessage: input.errorMessage } : {}),
    resultHash
  };
}
