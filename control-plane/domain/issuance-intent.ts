import { canonicalStringify, sha256 } from '../finance/determinism.ts';

export interface IssuanceIntent {
  issuance_id: string;
  subscription_id: string;
  receipt_id: string;
  issuance_plan_hash: string;
  status: 'pending';
  created_at: string;
}

export const ISSUANCE_PLAN_HASH_V1 = sha256(canonicalStringify({ plan: 'issuance_intent_v1' }));

export function computeIssuanceId(subscriptionId: string, receiptId: string): string {
  return sha256(`${subscriptionId}${receiptId}`);
}

export function buildIssuanceIntent(input: {
  subscriptionId: string;
  receiptId: string;
  createdAt: string;
  issuancePlanHash?: string;
}): IssuanceIntent {
  return {
    issuance_id: computeIssuanceId(input.subscriptionId, input.receiptId),
    subscription_id: input.subscriptionId,
    receipt_id: input.receiptId,
    issuance_plan_hash: input.issuancePlanHash ?? ISSUANCE_PLAN_HASH_V1,
    status: 'pending',
    created_at: input.createdAt
  };
}
