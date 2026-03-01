import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { ReceiptInput } from './types.ts';

export interface PaymentReceiptIdentity {
  subscriptionId: string;
  dealId: string;
  entityId: string;
  railType: 'evm_usdc' | 'wire';
  amount: string;
  currency: 'USDC' | 'USD';
  payerRef: string;
  receiptRef: string;
  toAccountRef: string;
  chainId?: number;
}

export interface PaymentReceiptMetadata {
  observedAt: string;
  sourceEventId: string;
}

export interface PaymentReceipt {
  receipt_id: string;
  subscription_id: string;
  deal_id: string;
  entity_id: string;
  rail_type: 'evm_usdc' | 'wire';
  amount: string;
  currency: 'USDC' | 'USD';
  payer_ref: string;
  receipt_ref: string;
  to_account_ref: string;
  chain_id: number | null;
  source_event_id: string;
  observed_at: string;
}

export function buildPaymentReceiptIdentity(input: ReceiptInput): PaymentReceiptIdentity {
  return {
    subscriptionId: input.subscriptionId,
    dealId: input.dealId,
    entityId: input.entityId,
    railType: input.railType,
    amount: input.amount,
    currency: input.currency,
    payerRef: input.payerRef,
    receiptRef: input.receiptRef,
    toAccountRef: input.toAccountRef,
    chainId: input.railType === 'evm_usdc' ? input.chainId : undefined
  };
}

export function computeReceiptId(input: ReceiptInput): string {
  return sha256(canonicalStringify(buildPaymentReceiptIdentity(input)));
}

export function buildPaymentReceipt(input: ReceiptInput, metadata: PaymentReceiptMetadata): PaymentReceipt {
  return {
    receipt_id: computeReceiptId(input),
    subscription_id: input.subscriptionId,
    deal_id: input.dealId,
    entity_id: input.entityId,
    rail_type: input.railType,
    amount: input.amount,
    currency: input.currency,
    payer_ref: input.payerRef,
    receipt_ref: input.receiptRef,
    to_account_ref: input.toAccountRef,
    chain_id: input.railType === 'evm_usdc' ? (input.chainId ?? null) : null,
    source_event_id: metadata.sourceEventId,
    observed_at: metadata.observedAt
  };
}
