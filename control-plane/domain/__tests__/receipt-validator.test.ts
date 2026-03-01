import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  ERR_ALREADY_FUNDED,
  ERR_AMOUNT_MISMATCH,
  ERR_DEAL_ACCOUNT_MISMATCH,
  ERR_DUPLICATE_RECEIPT,
  ERR_PAYER_UNAUTHORIZED,
  ERR_SUBSCRIPTION_NOT_FOUND,
  OK_RECEIPT_ACCEPTED,
  validateAndPersistReceipt
} from '../receipt-validator.ts';
import type { ReceiptInput } from '../types.ts';
import { clearServiceDbRegistryForTests, getServiceDb } from '../../service/storage/db.ts';
import { canonicalStringify } from '../../finance/determinism.ts';

const DB_PATH = ':memory:';
const OBSERVED_AT = '2026-02-28T00:00:00.000Z';

const BASE_INPUT: ReceiptInput = {
  subscriptionId: 'sub_001',
  dealId: 'deal_001',
  entityId: 'entity_001',
  railType: 'evm_usdc',
  amount: '1000.00',
  currency: 'USDC',
  payerRef: '0xwallet_1',
  receiptRef: 'rcpt_001',
  toAccountRef: 'acct_001',
  chainId: 1
};

function seedRegistry(): void {
  const db = getServiceDb(DB_PATH);
  db.prepare(`
    INSERT INTO deals (deal_id, receiving_account_ref)
    VALUES (?, ?)
  `).run('deal_001', 'acct_001');

  db.prepare(`
    INSERT INTO subscriptions (
      subscription_id,
      deal_id,
      entity_id,
      expected_amount,
      rail_type,
      currency,
      authorized_wallets_canonical,
      expected_wire_sender_ref
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'sub_001',
    'deal_001',
    'entity_001',
    '1000.00',
    'evm_usdc',
    'USDC',
    '["0xwallet_1","0xwallet_2"]',
    null
  );
}

describe('receipt validator', () => {
  beforeEach(() => {
    clearServiceDbRegistryForTests();
    seedRegistry();
  });

  afterEach(() => {
    clearServiceDbRegistryForTests();
  });

  it('accepts valid receipt and returns deterministic ids (T-V1)', () => {
    const db = getServiceDb(DB_PATH);
    const result = validateAndPersistReceipt(BASE_INPUT, 'event_001', {
      db,
      observedAt: OBSERVED_AT
    });

    expect(result.ok).toBe(true);
    expect(result).toMatchObject({
      ok: true,
      code: OK_RECEIPT_ACCEPTED
    });
    expect(canonicalStringify(result)).toMatchInlineSnapshot(
      `"{"code":"OK_RECEIPT_ACCEPTED","issuanceId":"f5a0a8aecf397ad55f839ae1f6d543594144558007221f72b610fa4317f50344","ok":true,"receiptId":"d2d804656b222011a392d4c955a7280d4cc5994c2b382a2d17cae072276b7a90"}"`
    );
  });

  it('returns ERR_SUBSCRIPTION_NOT_FOUND for unknown subscription (T-V2)', () => {
    const db = getServiceDb(DB_PATH);
    const result = validateAndPersistReceipt({ ...BASE_INPUT, subscriptionId: 'missing_sub' }, 'event_001', {
      db,
      observedAt: OBSERVED_AT
    });

    expect(result).toEqual({ ok: false, code: ERR_SUBSCRIPTION_NOT_FOUND });
  });

  it('returns ERR_AMOUNT_MISMATCH before later checks (T-V3)', () => {
    const db = getServiceDb(DB_PATH);
    const result = validateAndPersistReceipt(
      {
        ...BASE_INPUT,
        amount: '999.99',
        toAccountRef: 'wrong_account'
      },
      'event_001',
      {
        db,
        observedAt: OBSERVED_AT
      }
    );

    expect(result).toEqual({ ok: false, code: ERR_AMOUNT_MISMATCH });
  });

  it('returns ERR_DEAL_ACCOUNT_MISMATCH on account mismatch (T-V4)', () => {
    const db = getServiceDb(DB_PATH);
    const result = validateAndPersistReceipt({ ...BASE_INPUT, toAccountRef: 'acct_wrong' }, 'event_001', {
      db,
      observedAt: OBSERVED_AT
    });

    expect(result).toEqual({ ok: false, code: ERR_DEAL_ACCOUNT_MISMATCH });
  });

  it('returns ERR_PAYER_UNAUTHORIZED when payer is not allowed (T-V5)', () => {
    const db = getServiceDb(DB_PATH);
    const result = validateAndPersistReceipt({ ...BASE_INPUT, payerRef: '0xwallet_not_allowed' }, 'event_001', {
      db,
      observedAt: OBSERVED_AT
    });

    expect(result).toEqual({ ok: false, code: ERR_PAYER_UNAUTHORIZED });
  });

  it('returns ERR_DUPLICATE_RECEIPT for duplicate receipt_ref (T-V6)', () => {
    const db = getServiceDb(DB_PATH);

    const first = validateAndPersistReceipt(BASE_INPUT, 'event_001', {
      db,
      observedAt: OBSERVED_AT
    });
    expect(first).toMatchObject({ ok: true, code: OK_RECEIPT_ACCEPTED });

    db.prepare(`
      INSERT INTO subscriptions (
        subscription_id,
        deal_id,
        entity_id,
        expected_amount,
        rail_type,
        currency,
        authorized_wallets_canonical,
        expected_wire_sender_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'sub_002',
      'deal_001',
      'entity_001',
      '1000.00',
      'evm_usdc',
      'USDC',
      '["0xwallet_1"]',
      null
    );

    const second = validateAndPersistReceipt(
      {
        ...BASE_INPUT,
        subscriptionId: 'sub_002'
      },
      'event_002',
      {
        db,
        observedAt: OBSERVED_AT
      }
    );

    expect(second).toEqual({ ok: false, code: ERR_DUPLICATE_RECEIPT });
  });

  it('returns ERR_ALREADY_FUNDED when subscription already has receipt (T-V7)', () => {
    const db = getServiceDb(DB_PATH);

    const first = validateAndPersistReceipt(BASE_INPUT, 'event_001', {
      db,
      observedAt: OBSERVED_AT
    });
    expect(first).toMatchObject({ ok: true, code: OK_RECEIPT_ACCEPTED });

    const second = validateAndPersistReceipt(
      {
        ...BASE_INPUT,
        receiptRef: 'rcpt_002'
      },
      'event_002',
      {
        db,
        observedAt: OBSERVED_AT
      }
    );

    expect(second).toEqual({ ok: false, code: ERR_ALREADY_FUNDED });
  });
});
