import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import { normalizeString, uniqueSorted, uniqueSortedRails } from './commerce-normalizer.ts';
import type {
  ChargeIntent,
  CommerceHistoryEvent,
  PaymentReceipt,
  RailBinding,
  RailClass,
  RailEligibility,
  SettlementLog,
} from './charge-intent-types.ts';

export function normalizeChargeIntentIdentityPayload(payload: {
  buildEvidenceBundleId: string;
  runId: string;
  packetId: string;
  bundleId: string;
  graphId: string;
  taskId: string;
  planId: string;
  productSpecId: string;
  monetizationClass: string;
  amount: string;
  currency: string;
  payTo: string;
  railClasses: RailClass[];
}) {
  return {
    buildEvidenceBundleId: normalizeString(payload.buildEvidenceBundleId),
    runId: normalizeString(payload.runId),
    packetId: normalizeString(payload.packetId),
    bundleId: normalizeString(payload.bundleId),
    graphId: normalizeString(payload.graphId),
    taskId: normalizeString(payload.taskId),
    planId: normalizeString(payload.planId),
    productSpecId: normalizeString(payload.productSpecId),
    monetizationClass: normalizeString(payload.monetizationClass),
    amount: normalizeString(payload.amount),
    currency: normalizeString(payload.currency).toUpperCase(),
    payTo: normalizeString(payload.payTo),
    railClasses: uniqueSortedRails(payload.railClasses),
  };
}

export function deriveChargeIntentId(payload: {
  buildEvidenceBundleId: string;
  runId: string;
  packetId: string;
  bundleId: string;
  graphId: string;
  taskId: string;
  planId: string;
  productSpecId: string;
  monetizationClass: string;
  amount: string;
  currency: string;
  payTo: string;
  railClasses: RailClass[];
}): string {
  return sha256(canonicalStringify(normalizeChargeIntentIdentityPayload(payload)));
}

export function deriveRailBindingId(payload: {
  chargeIntentId: string;
  railClass: string;
  bindingClass: string;
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    chargeIntentId: normalizeString(payload.chargeIntentId),
    railClass: normalizeString(payload.railClass),
    bindingClass: normalizeString(payload.bindingClass),
    reasonTokens: uniqueSorted(payload.reasonTokens.map((entry) => normalizeString(entry))),
  }));
}

export function deriveRailEligibilityId(payload: {
  chargeIntentId: string;
  railBindingId: string;
  eligibilityStatus: string;
  reasonTokens: string[];
  blockingConditionTokens: string[];
}): string {
  return sha256(canonicalStringify({
    chargeIntentId: normalizeString(payload.chargeIntentId),
    railBindingId: normalizeString(payload.railBindingId),
    eligibilityStatus: normalizeString(payload.eligibilityStatus),
    reasonTokens: uniqueSorted(payload.reasonTokens.map((entry) => normalizeString(entry))),
    blockingConditionTokens: uniqueSorted(payload.blockingConditionTokens.map((entry) => normalizeString(entry))),
  }));
}

export function derivePaymentReceiptId(payload: {
  chargeIntentId: string;
  railBindingId: string;
  receiptClass: string;
  receiptReference: string;
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    chargeIntentId: normalizeString(payload.chargeIntentId),
    railBindingId: normalizeString(payload.railBindingId),
    receiptClass: normalizeString(payload.receiptClass),
    receiptReference: normalizeString(payload.receiptReference),
    reasonTokens: uniqueSorted(payload.reasonTokens.map((entry) => normalizeString(entry))),
  }));
}

export function deriveSettlementLogId(payload: {
  chargeIntentId: string;
  paymentReceiptId: string;
  railBindingId: string;
  settlementClass: string;
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    chargeIntentId: normalizeString(payload.chargeIntentId),
    paymentReceiptId: normalizeString(payload.paymentReceiptId),
    railBindingId: normalizeString(payload.railBindingId),
    settlementClass: normalizeString(payload.settlementClass),
    reasonTokens: uniqueSorted(payload.reasonTokens.map((entry) => normalizeString(entry))),
  }));
}

export function computeCommerceHistoryEventHash(event: CommerceHistoryEvent): string {
  return sha256(canonicalStringify({
    chargeIntentId: normalizeString(event.chargeIntentId),
    eventType: normalizeString(event.eventType),
    payloadHash: normalizeString(event.payloadHash),
  }));
}

export function computeChargeIntentSemanticHash(intent: ChargeIntent): string {
  return sha256(canonicalStringify(normalizeChargeIntentIdentityPayload(intent)));
}

export function computeRailBindingSemanticHash(binding: RailBinding): string {
  return sha256(canonicalStringify({
    chargeIntentId: binding.chargeIntentId,
    railClass: binding.railClass,
    bindingClass: binding.bindingClass,
    reasonTokens: [...binding.reasonTokens].sort((left, right) => left.localeCompare(right)),
    state: binding.state,
  }));
}

export function computeRailEligibilitySemanticHash(eligibility: RailEligibility): string {
  return sha256(canonicalStringify({
    chargeIntentId: eligibility.chargeIntentId,
    railBindingId: eligibility.railBindingId,
    eligibilityStatus: eligibility.eligibilityStatus,
    reasonTokens: [...eligibility.reasonTokens].sort((left, right) => left.localeCompare(right)),
    blockingConditionTokens: [...eligibility.blockingConditionTokens].sort((left, right) => left.localeCompare(right)),
    state: eligibility.state,
  }));
}

export function computePaymentReceiptSemanticHash(receipt: PaymentReceipt): string {
  return sha256(canonicalStringify({
    chargeIntentId: receipt.chargeIntentId,
    railBindingId: receipt.railBindingId,
    receiptClass: receipt.receiptClass,
    receiptReference: receipt.receiptReference,
    reasonTokens: [...receipt.reasonTokens].sort((left, right) => left.localeCompare(right)),
    state: receipt.state,
  }));
}

export function computeSettlementLogSemanticHash(entry: SettlementLog): string {
  return sha256(canonicalStringify({
    chargeIntentId: entry.chargeIntentId,
    paymentReceiptId: entry.paymentReceiptId,
    railBindingId: entry.railBindingId,
    settlementClass: entry.settlementClass,
    reasonTokens: [...entry.reasonTokens].sort((left, right) => left.localeCompare(right)),
    state: entry.state,
  }));
}
