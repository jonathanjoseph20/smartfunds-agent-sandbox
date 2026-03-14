import { canonicalStringify } from '../finance/determinism.ts';

import { deriveCommerceOutcome } from './commerce-outcome.ts';
import { deriveCommerceStatus } from './commerce-status.ts';
import { computePaymentReceiptSemanticHash } from './charge-intent-identity.ts';
import { cloneRecord } from './commerce-normalizer.ts';
import { derivePaymentReceiptsFromEligibility } from './payment-receipt.ts';
import { deriveRailBindingsForChargeIntent } from './rail-binding.ts';
import { deriveRailEligibilityForBindings } from './rail-eligibility.ts';
import { deriveSettlementLogsFromReceipts } from './settlement-log.ts';
import type {
  ChargeIntent,
  CommerceHistoryEvent,
  CommerceProjection,
  PaymentReceipt,
  RailBinding,
  RailEligibility,
  SettlementLog,
} from './charge-intent-types.ts';

function sortByCanonical<T>(values: T[]): T[] {
  return [...values].sort((left, right) => canonicalStringify(left).localeCompare(canonicalStringify(right)));
}

function mergeReceipts(base: PaymentReceipt[], manual: PaymentReceipt[]): PaymentReceipt[] {
  const byHash = new Map<string, PaymentReceipt>();

  for (const receipt of sortByCanonical([...base, ...manual])) {
    byHash.set(computePaymentReceiptSemanticHash(receipt), receipt);
  }

  return [...byHash.values()].sort((left, right) => left.paymentReceiptId.localeCompare(right.paymentReceiptId));
}

export function projectCommerce(input: {
  chargeIntent: ChargeIntent;
  manualPaymentReceipts: PaymentReceipt[];
  history: CommerceHistoryEvent[];
}): CommerceProjection {
  const railBindingSummaries: RailBinding[] = deriveRailBindingsForChargeIntent(input.chargeIntent);
  const railEligibilitySummaries: RailEligibility[] = deriveRailEligibilityForBindings({
    chargeIntent: input.chargeIntent,
    railBindings: railBindingSummaries,
  });

  const derivedReceipts = derivePaymentReceiptsFromEligibility({
    chargeIntentId: input.chargeIntent.chargeIntentId,
    railEligibility: railEligibilitySummaries,
  });

  const paymentReceiptSummaries = mergeReceipts(derivedReceipts, input.manualPaymentReceipts)
    .sort((left, right) => left.paymentReceiptId.localeCompare(right.paymentReceiptId));

  const settlementLogSummaries: SettlementLog[] = deriveSettlementLogsFromReceipts({
    chargeIntentId: input.chargeIntent.chargeIntentId,
    paymentReceipts: paymentReceiptSummaries,
  });

  const status = deriveCommerceStatus({
    chargeIntent: input.chargeIntent,
    railEligibility: railEligibilitySummaries,
    paymentReceipts: paymentReceiptSummaries,
    settlementLogs: settlementLogSummaries,
  });

  const outcome = deriveCommerceOutcome({
    amount: input.chargeIntent.amount,
    status,
  });

  return {
    chargeIntentId: input.chargeIntent.chargeIntentId,
    buildEvidenceBundleId: input.chargeIntent.buildEvidenceBundleId,
    runId: input.chargeIntent.runId,
    productSpecId: input.chargeIntent.productSpecId,
    railBindingSummaries,
    railEligibilitySummaries,
    paymentReceiptSummaries,
    settlementLogSummaries,
    status,
    outcome,
    commerceHistory: [...input.history]
      .map((entry) => ({
        chargeIntentId: entry.chargeIntentId,
        eventType: entry.eventType,
        payloadHash: entry.payloadHash,
        payload: cloneRecord(entry.payload),
      }))
      .sort((left, right) => {
        const byType = left.eventType.localeCompare(right.eventType);
        if (byType !== 0) {
          return byType;
        }

        return left.payloadHash.localeCompare(right.payloadHash);
      }),
  };
}
