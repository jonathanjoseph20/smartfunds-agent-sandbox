import type { DatabaseSync } from 'node:sqlite';

export interface SubscriptionRecord {
  subscription_id: string;
  deal_id: string;
  entity_id: string;
  expected_amount: string;
  rail_type: 'evm_usdc' | 'wire';
  currency: 'USDC' | 'USD';
  authorized_wallets_canonical: string;
  expected_wire_sender_ref: string | null;
}

export interface DealRecord {
  deal_id: string;
  receiving_account_ref: string;
}

export function getSubscriptionById(db: DatabaseSync, subscriptionId: string): SubscriptionRecord | null {
  const row = db.prepare('SELECT * FROM subscriptions WHERE subscription_id = ?').get(subscriptionId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    subscription_id: row.subscription_id as string,
    deal_id: row.deal_id as string,
    entity_id: row.entity_id as string,
    expected_amount: row.expected_amount as string,
    rail_type: row.rail_type as 'evm_usdc' | 'wire',
    currency: row.currency as 'USDC' | 'USD',
    authorized_wallets_canonical: row.authorized_wallets_canonical as string,
    expected_wire_sender_ref: (row.expected_wire_sender_ref as string | null) ?? null
  };
}

export function getDealById(db: DatabaseSync, dealId: string): DealRecord | null {
  const row = db.prepare('SELECT * FROM deals WHERE deal_id = ?').get(dealId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    deal_id: row.deal_id as string,
    receiving_account_ref: row.receiving_account_ref as string
  };
}
