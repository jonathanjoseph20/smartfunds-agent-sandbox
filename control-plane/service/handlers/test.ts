import { canonicalStringify } from '../../finance/determinism.ts';
import {
  OK_RECEIPT_ACCEPTED,
  validateAndPersistReceipt
} from '../../domain/receipt-validator.ts';
import type { ReceiptInput } from '../../domain/types.ts';

import type { HandlerResult, IngestedEvent, ServiceHandler } from './types.ts';

function isReceiptInput(value: unknown): value is ReceiptInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const input = value as Record<string, unknown>;
  const hasRequiredStrings = (
    typeof input.subscriptionId === 'string' &&
    typeof input.dealId === 'string' &&
    typeof input.entityId === 'string' &&
    typeof input.amount === 'string' &&
    typeof input.payerRef === 'string' &&
    typeof input.receiptRef === 'string' &&
    typeof input.toAccountRef === 'string'
  );

  if (!hasRequiredStrings) {
    return false;
  }

  const railTypeValid = input.railType === 'evm_usdc' || input.railType === 'wire';
  const currencyValid = input.currency === 'USDC' || input.currency === 'USD';
  const chainIdValid = input.chainId === undefined || Number.isInteger(input.chainId);

  return railTypeValid && currencyValid && chainIdValid;
}

function invalidInputResult(): HandlerResult {
  return {
    ok: false,
    code: 'INVALID_RECEIPT_INPUT',
    summaryCanonical: canonicalStringify({ ok: false, code: 'INVALID_RECEIPT_INPUT' })
  };
}

export const TestHandler: ServiceHandler = {
  handle(event: IngestedEvent, context): HandlerResult {
    let payload: unknown;

    try {
      payload = JSON.parse(event.payload_canonical) as unknown;
    } catch {
      return invalidInputResult();
    }

    if (!isReceiptInput(payload)) {
      return invalidInputResult();
    }

    const result = validateAndPersistReceipt(payload, event.event_id, {
      db: context.db,
      observedAt: context.now
    });

    if (result.ok && result.code === OK_RECEIPT_ACCEPTED) {
      return {
        ok: true,
        code: result.code,
        receiptId: result.receiptId,
        issuanceId: result.issuanceId,
        summaryCanonical: canonicalStringify({
          ok: true,
          code: result.code,
          receiptId: result.receiptId,
          issuanceId: result.issuanceId
        })
      };
    }

    return {
      ok: false,
      code: result.code,
      summaryCanonical: canonicalStringify({ ok: false, code: result.code })
    };
  }
};
