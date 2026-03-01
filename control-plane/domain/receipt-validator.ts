import type { DatabaseSync } from 'node:sqlite';

import { buildIssuanceIntent } from './issuance-intent.ts';
import { buildPaymentReceipt } from './payment-receipt.ts';
import type { ReceiptInput } from './types.ts';
import { getServiceDb } from '../service/storage/db.ts';
import { getDealById, getSubscriptionById } from '../service/storage/registry.ts';
import {
  getReceiptByReceiptRef,
  getReceiptBySubscriptionId,
  insertIssuanceIntent,
  insertPaymentReceipt
} from '../service/storage/receipts.ts';

export const ERR_SUBSCRIPTION_NOT_FOUND = 'ERR_SUBSCRIPTION_NOT_FOUND';
export const ERR_AMOUNT_MISMATCH = 'ERR_AMOUNT_MISMATCH';
export const ERR_DEAL_ACCOUNT_MISMATCH = 'ERR_DEAL_ACCOUNT_MISMATCH';
export const ERR_PAYER_UNAUTHORIZED = 'ERR_PAYER_UNAUTHORIZED';
export const ERR_DUPLICATE_RECEIPT = 'ERR_DUPLICATE_RECEIPT';
export const ERR_ALREADY_FUNDED = 'ERR_ALREADY_FUNDED';
export const OK_RECEIPT_ACCEPTED = 'OK_RECEIPT_ACCEPTED';

interface ValidationFailure {
  ok: false;
  code:
    | typeof ERR_SUBSCRIPTION_NOT_FOUND
    | typeof ERR_AMOUNT_MISMATCH
    | typeof ERR_DEAL_ACCOUNT_MISMATCH
    | typeof ERR_PAYER_UNAUTHORIZED
    | typeof ERR_DUPLICATE_RECEIPT
    | typeof ERR_ALREADY_FUNDED;
}

interface ValidationSuccess {
  ok: true;
  code: typeof OK_RECEIPT_ACCEPTED;
  receiptId: string;
  issuanceId: string;
}

export type ValidationResult = ValidationFailure | ValidationSuccess;

export interface ValidationContext {
  db: DatabaseSync;
  observedAt: string;
}

function parseAuthorizedWallets(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

function isPayerAuthorized(input: ReceiptInput, expectedWireSenderRef: string | null, authorizedWalletsCanonical: string): boolean {
  if (input.railType === 'evm_usdc') {
    const wallets = parseAuthorizedWallets(authorizedWalletsCanonical);
    return wallets.includes(input.payerRef);
  }

  if (!expectedWireSenderRef) {
    return true;
  }

  return expectedWireSenderRef === input.payerRef;
}

export function validateAndPersistReceipt(
  input: ReceiptInput,
  sourceEventId: string,
  context?: ValidationContext
): ValidationResult {
  const db = context?.db ?? getServiceDb();
  const observedAt = context?.observedAt ?? '';

  const subscription = getSubscriptionById(db, input.subscriptionId);
  if (!subscription) {
    return { ok: false, code: ERR_SUBSCRIPTION_NOT_FOUND };
  }

  if (input.amount !== subscription.expected_amount) {
    return { ok: false, code: ERR_AMOUNT_MISMATCH };
  }

  const deal = getDealById(db, input.dealId);
  if (!deal || input.toAccountRef !== deal.receiving_account_ref) {
    return { ok: false, code: ERR_DEAL_ACCOUNT_MISMATCH };
  }

  if (!isPayerAuthorized(input, subscription.expected_wire_sender_ref, subscription.authorized_wallets_canonical)) {
    return { ok: false, code: ERR_PAYER_UNAUTHORIZED };
  }

  const duplicateReceiptRef = getReceiptByReceiptRef(db, input.receiptRef);
  if (duplicateReceiptRef) {
    return { ok: false, code: ERR_DUPLICATE_RECEIPT };
  }

  const existingBySubscription = getReceiptBySubscriptionId(db, input.subscriptionId);
  if (existingBySubscription) {
    return { ok: false, code: ERR_ALREADY_FUNDED };
  }

  const paymentReceipt = buildPaymentReceipt(input, {
    observedAt,
    sourceEventId
  });
  insertPaymentReceipt(db, paymentReceipt);

  const issuanceIntent = buildIssuanceIntent({
    subscriptionId: input.subscriptionId,
    receiptId: paymentReceipt.receipt_id,
    createdAt: observedAt
  });
  insertIssuanceIntent(db, issuanceIntent);

  return {
    ok: true,
    code: OK_RECEIPT_ACCEPTED,
    receiptId: paymentReceipt.receipt_id,
    issuanceId: issuanceIntent.issuance_id
  };
}
