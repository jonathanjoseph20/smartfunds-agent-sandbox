export const MONETIZATION_CLASSES = [
  'product_access',
  'service_execution',
  'artifact_delivery',
  'subscription',
  'internal_billing',
] as const;

export const RAIL_CLASSES = [
  'stripe',
  'evm_wallet',
  'erebor',
] as const;

export const RAIL_BINDING_CLASSES = [
  'primary_binding',
  'fallback_binding',
  'manual_binding',
  'blocked_binding',
] as const;

export const RAIL_ELIGIBILITY_STATUSES = [
  'eligible',
  'conditionally_eligible',
  'blocked',
  'incompatible',
  'inconclusive',
] as const;

export const PAYMENT_RECEIPT_CLASSES = [
  'payment_received',
  'payment_pending',
  'payment_failed',
  'payment_blocked',
  'payment_inconclusive',
] as const;

export const SETTLEMENT_CLASSES = [
  'settlement_pending',
  'settlement_completed',
  'settlement_failed',
  'settlement_blocked',
  'settlement_inconclusive',
] as const;

export const COMMERCE_STATUSES = [
  'draft',
  'pending',
  'fulfilled',
  'blocked',
  'failed',
  'inconclusive',
] as const;

export const COMMERCE_OUTCOMES = [
  'no_charge',
  'pending_settlement',
  'settled',
  'blocked',
  'failed',
  'inconclusive',
] as const;

export const COMMERCE_HISTORY_EVENT_TYPES = [
  'charge_intent_created',
  'rail_binding_recorded',
  'rail_eligibility_evaluated',
  'payment_receipt_recorded',
  'settlement_logged',
  'commerce_materialized',
  'commerce_failed',
] as const;

export type MonetizationClass = typeof MONETIZATION_CLASSES[number];
export type RailClass = typeof RAIL_CLASSES[number];
export type RailBindingClass = typeof RAIL_BINDING_CLASSES[number];
export type RailEligibilityStatus = typeof RAIL_ELIGIBILITY_STATUSES[number];
export type PaymentReceiptClass = typeof PAYMENT_RECEIPT_CLASSES[number];
export type SettlementClass = typeof SETTLEMENT_CLASSES[number];
export type CommerceStatus = typeof COMMERCE_STATUSES[number];
export type CommerceOutcome = typeof COMMERCE_OUTCOMES[number];
export type CommerceHistoryEventType = typeof COMMERCE_HISTORY_EVENT_TYPES[number];

export type CommerceState = 'active' | 'blocked' | 'failed' | 'inconclusive';

export type ChargeIntent = {
  chargeIntentId: string;
  buildEvidenceBundleId: string;
  runId: string;
  packetId: string;
  bundleId: string;
  graphId: string;
  taskId: string;
  planId: string;
  productSpecId: string;
  monetizationClass: MonetizationClass;
  amount: string;
  currency: string;
  payTo: string;
  railClasses: RailClass[];
  status: CommerceStatus;
  outcome: CommerceOutcome;
};

export type RailBinding = {
  railBindingId: string;
  chargeIntentId: string;
  railClass: RailClass;
  bindingClass: RailBindingClass;
  reasonTokens: string[];
  state: CommerceState;
};

export type RailEligibility = {
  railEligibilityId: string;
  chargeIntentId: string;
  railBindingId: string;
  eligibilityStatus: RailEligibilityStatus;
  reasonTokens: string[];
  blockingConditionTokens: string[];
  state: CommerceState;
};

export type PaymentReceipt = {
  paymentReceiptId: string;
  chargeIntentId: string;
  railBindingId: string;
  receiptClass: PaymentReceiptClass;
  receiptReference: string;
  reasonTokens: string[];
  state: CommerceState;
};

export type SettlementLog = {
  settlementLogId: string;
  chargeIntentId: string;
  paymentReceiptId: string;
  railBindingId: string;
  settlementClass: SettlementClass;
  reasonTokens: string[];
  state: CommerceState;
};

export type CommerceHistoryEvent = {
  chargeIntentId: string;
  eventType: CommerceHistoryEventType;
  payloadHash: string;
  payload: Record<string, unknown>;
};

export type CommerceProjection = {
  chargeIntentId: string;
  buildEvidenceBundleId: string;
  runId: string;
  productSpecId: string;
  railBindingSummaries: RailBinding[];
  railEligibilitySummaries: RailEligibility[];
  paymentReceiptSummaries: PaymentReceipt[];
  settlementLogSummaries: SettlementLog[];
  status: CommerceStatus;
  outcome: CommerceOutcome;
  commerceHistory: CommerceHistoryEvent[];
};

export type CommerceMaterializationSummary = {
  chargeIntentId: string;
  dirPath: string;
  statusPath: string;
  railBindingsPath: string;
  railEligibilityPath: string;
  paymentReceiptsPath: string;
  settlementLogPath: string;
  historyPath: string;
  outcomePath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
};

export type ChargeIntentCreateInput = {
  buildEvidenceBundleId: string;
  monetizationClass?: MonetizationClass;
  amount?: string;
  currency?: string;
  payTo?: string;
  railClasses?: RailClass[];
};

export type PaymentReceiptRecordInput = {
  chargeIntentId: string;
  railBindingId: string;
  receiptClass: PaymentReceiptClass;
  receiptReference: string;
  reasonTokens?: string[];
};
