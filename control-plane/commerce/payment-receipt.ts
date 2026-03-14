import { derivePaymentReceiptId } from './charge-intent-identity.ts';
import { normalizeString, uniqueSorted } from './commerce-normalizer.ts';
import type {
  PaymentReceipt,
  PaymentReceiptClass,
  PaymentReceiptRecordInput,
  RailEligibility,
} from './charge-intent-types.ts';

function classFromEligibility(eligibility: RailEligibility): PaymentReceiptClass {
  if (eligibility.eligibilityStatus === 'eligible') {
    return 'payment_pending';
  }

  if (eligibility.eligibilityStatus === 'conditionally_eligible') {
    return 'payment_inconclusive';
  }

  if (eligibility.eligibilityStatus === 'blocked' || eligibility.eligibilityStatus === 'incompatible') {
    return 'payment_blocked';
  }

  return 'payment_inconclusive';
}

function stateFromReceiptClass(receiptClass: PaymentReceiptClass): PaymentReceipt['state'] {
  if (receiptClass === 'payment_received' || receiptClass === 'payment_pending') {
    return 'active';
  }

  if (receiptClass === 'payment_failed') {
    return 'failed';
  }

  if (receiptClass === 'payment_blocked') {
    return 'blocked';
  }

  return 'inconclusive';
}

export function derivePaymentReceiptsFromEligibility(input: {
  chargeIntentId: string;
  railEligibility: RailEligibility[];
}): PaymentReceipt[] {
  return input.railEligibility.map((eligibility) => {
    const receiptClass = classFromEligibility(eligibility);
    const reasonTokens = uniqueSorted([
      `eligibility:${eligibility.eligibilityStatus}`,
      ...eligibility.reasonTokens,
    ]);
    const receiptReference = `derived::${eligibility.railBindingId.slice(0, 16)}`;

    return {
      paymentReceiptId: derivePaymentReceiptId({
        chargeIntentId: input.chargeIntentId,
        railBindingId: eligibility.railBindingId,
        receiptClass,
        receiptReference,
        reasonTokens,
      }),
      chargeIntentId: input.chargeIntentId,
      railBindingId: eligibility.railBindingId,
      receiptClass,
      receiptReference,
      reasonTokens,
      state: stateFromReceiptClass(receiptClass),
    };
  }).sort((left, right) => left.paymentReceiptId.localeCompare(right.paymentReceiptId));
}

export function createManualPaymentReceipt(input: PaymentReceiptRecordInput): PaymentReceipt {
  const reasonTokens = uniqueSorted((input.reasonTokens ?? []).map((entry) => normalizeString(entry)).filter((entry) => entry.length > 0));

  return {
    paymentReceiptId: derivePaymentReceiptId({
      chargeIntentId: input.chargeIntentId,
      railBindingId: input.railBindingId,
      receiptClass: input.receiptClass,
      receiptReference: input.receiptReference,
      reasonTokens,
    }),
    chargeIntentId: input.chargeIntentId,
    railBindingId: input.railBindingId,
    receiptClass: input.receiptClass,
    receiptReference: normalizeString(input.receiptReference),
    reasonTokens,
    state: stateFromReceiptClass(input.receiptClass),
  };
}
