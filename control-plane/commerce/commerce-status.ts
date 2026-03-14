import type {
  ChargeIntent,
  CommerceStatus,
  PaymentReceipt,
  RailEligibility,
  SettlementLog,
} from './charge-intent-types.ts';

function hasAny<T>(values: T[], predicate: (value: T) => boolean): boolean {
  return values.some(predicate);
}

export function deriveCommerceStatus(input: {
  chargeIntent: ChargeIntent;
  railEligibility: RailEligibility[];
  paymentReceipts: PaymentReceipt[];
  settlementLogs: SettlementLog[];
}): CommerceStatus {
  if (input.chargeIntent.amount === '0.00') {
    return 'fulfilled';
  }

  if (input.paymentReceipts.length === 0 && input.settlementLogs.length === 0) {
    return 'draft';
  }

  if (hasAny(input.settlementLogs, (entry) => entry.settlementClass === 'settlement_failed')) {
    return 'failed';
  }

  if (hasAny(input.settlementLogs, (entry) => entry.settlementClass === 'settlement_blocked')) {
    return 'blocked';
  }

  if (hasAny(input.settlementLogs, (entry) => entry.settlementClass === 'settlement_inconclusive')) {
    return 'inconclusive';
  }

  if (hasAny(input.settlementLogs, (entry) => entry.settlementClass === 'settlement_completed')) {
    return 'fulfilled';
  }

  const allRailsBlocked = input.railEligibility.length > 0
    && input.railEligibility.every((entry) => entry.eligibilityStatus === 'blocked' || entry.eligibilityStatus === 'incompatible');

  if (allRailsBlocked) {
    return 'blocked';
  }

  return 'pending';
}
