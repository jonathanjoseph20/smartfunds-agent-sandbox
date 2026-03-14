import { deriveSettlementLogId } from './charge-intent-identity.ts';
import { uniqueSorted } from './commerce-normalizer.ts';
import type { PaymentReceipt, SettlementClass, SettlementLog } from './charge-intent-types.ts';

function toSettlementClass(receipt: PaymentReceipt): SettlementClass {
  if (receipt.receiptClass === 'payment_received') {
    return 'settlement_completed';
  }

  if (receipt.receiptClass === 'payment_pending') {
    return 'settlement_pending';
  }

  if (receipt.receiptClass === 'payment_failed') {
    return 'settlement_failed';
  }

  if (receipt.receiptClass === 'payment_blocked') {
    return 'settlement_blocked';
  }

  return 'settlement_inconclusive';
}

function toState(settlementClass: SettlementClass): SettlementLog['state'] {
  if (settlementClass === 'settlement_completed' || settlementClass === 'settlement_pending') {
    return 'active';
  }

  if (settlementClass === 'settlement_failed') {
    return 'failed';
  }

  if (settlementClass === 'settlement_blocked') {
    return 'blocked';
  }

  return 'inconclusive';
}

export function deriveSettlementLogsFromReceipts(input: {
  chargeIntentId: string;
  paymentReceipts: PaymentReceipt[];
}): SettlementLog[] {
  return input.paymentReceipts.map((receipt) => {
    const settlementClass = toSettlementClass(receipt);
    const reasonTokens = uniqueSorted([
      `receipt:${receipt.receiptClass}`,
      ...receipt.reasonTokens,
    ]);

    return {
      settlementLogId: deriveSettlementLogId({
        chargeIntentId: input.chargeIntentId,
        paymentReceiptId: receipt.paymentReceiptId,
        railBindingId: receipt.railBindingId,
        settlementClass,
        reasonTokens,
      }),
      chargeIntentId: input.chargeIntentId,
      paymentReceiptId: receipt.paymentReceiptId,
      railBindingId: receipt.railBindingId,
      settlementClass,
      reasonTokens,
      state: toState(settlementClass),
    };
  }).sort((left, right) => left.settlementLogId.localeCompare(right.settlementLogId));
}
