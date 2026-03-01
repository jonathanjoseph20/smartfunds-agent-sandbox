import type { DatabaseSync } from 'node:sqlite';

import type { IssuanceIntent } from '../../domain/issuance-intent.ts';
import type { PaymentReceipt } from '../../domain/payment-receipt.ts';

export interface PaymentReceiptRecord extends PaymentReceipt {}

export interface IssuanceIntentRecord {
  issuance_id: string;
  subscription_id: string;
  receipt_id: string;
  issuance_plan_hash: string;
  status: 'pending';
  created_at: string;
}

export function getReceiptByReceiptRef(db: DatabaseSync, receiptRef: string): PaymentReceiptRecord | null {
  const row = db.prepare('SELECT * FROM payment_receipts WHERE receipt_ref = ?').get(receiptRef) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    receipt_id: row.receipt_id as string,
    subscription_id: row.subscription_id as string,
    deal_id: row.deal_id as string,
    entity_id: row.entity_id as string,
    rail_type: row.rail_type as 'evm_usdc' | 'wire',
    amount: row.amount as string,
    currency: row.currency as 'USDC' | 'USD',
    payer_ref: row.payer_ref as string,
    receipt_ref: row.receipt_ref as string,
    to_account_ref: row.to_account_ref as string,
    chain_id: (row.chain_id as number | null) ?? null,
    source_event_id: row.source_event_id as string,
    observed_at: row.observed_at as string
  };
}

export function getReceiptBySubscriptionId(db: DatabaseSync, subscriptionId: string): PaymentReceiptRecord | null {
  const row = db.prepare('SELECT * FROM payment_receipts WHERE subscription_id = ?').get(subscriptionId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    receipt_id: row.receipt_id as string,
    subscription_id: row.subscription_id as string,
    deal_id: row.deal_id as string,
    entity_id: row.entity_id as string,
    rail_type: row.rail_type as 'evm_usdc' | 'wire',
    amount: row.amount as string,
    currency: row.currency as 'USDC' | 'USD',
    payer_ref: row.payer_ref as string,
    receipt_ref: row.receipt_ref as string,
    to_account_ref: row.to_account_ref as string,
    chain_id: (row.chain_id as number | null) ?? null,
    source_event_id: row.source_event_id as string,
    observed_at: row.observed_at as string
  };
}

export function getReceiptById(db: DatabaseSync, receiptId: string): PaymentReceiptRecord | null {
  const row = db.prepare('SELECT * FROM payment_receipts WHERE receipt_id = ?').get(receiptId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    receipt_id: row.receipt_id as string,
    subscription_id: row.subscription_id as string,
    deal_id: row.deal_id as string,
    entity_id: row.entity_id as string,
    rail_type: row.rail_type as 'evm_usdc' | 'wire',
    amount: row.amount as string,
    currency: row.currency as 'USDC' | 'USD',
    payer_ref: row.payer_ref as string,
    receipt_ref: row.receipt_ref as string,
    to_account_ref: row.to_account_ref as string,
    chain_id: (row.chain_id as number | null) ?? null,
    source_event_id: row.source_event_id as string,
    observed_at: row.observed_at as string
  };
}

export function insertPaymentReceipt(db: DatabaseSync, receipt: PaymentReceipt): void {
  db.prepare(`
    INSERT INTO payment_receipts (
      receipt_id,
      subscription_id,
      deal_id,
      entity_id,
      rail_type,
      amount,
      currency,
      payer_ref,
      receipt_ref,
      to_account_ref,
      chain_id,
      source_event_id,
      observed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    receipt.receipt_id,
    receipt.subscription_id,
    receipt.deal_id,
    receipt.entity_id,
    receipt.rail_type,
    receipt.amount,
    receipt.currency,
    receipt.payer_ref,
    receipt.receipt_ref,
    receipt.to_account_ref,
    receipt.chain_id,
    receipt.source_event_id,
    receipt.observed_at
  );
}

export function insertIssuanceIntent(db: DatabaseSync, intent: IssuanceIntent): void {
  db.prepare(`
    INSERT INTO issuance_intents (
      issuance_id,
      subscription_id,
      receipt_id,
      issuance_plan_hash,
      status,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    intent.issuance_id,
    intent.subscription_id,
    intent.receipt_id,
    intent.issuance_plan_hash,
    intent.status,
    intent.created_at
  );
}

export function getIssuanceById(db: DatabaseSync, issuanceId: string): IssuanceIntentRecord | null {
  const row = db.prepare('SELECT * FROM issuance_intents WHERE issuance_id = ?').get(issuanceId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    issuance_id: row.issuance_id as string,
    subscription_id: row.subscription_id as string,
    receipt_id: row.receipt_id as string,
    issuance_plan_hash: row.issuance_plan_hash as string,
    status: row.status as 'pending',
    created_at: row.created_at as string
  };
}
