import type { DatabaseSync } from 'node:sqlite';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS ingested_events (
    event_id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    payload_canonical TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('received', 'processed', 'failed')),
    error_code TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    handler TEXT NOT NULL,
    attempt_index INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'done', 'failed')),
    result_canonical TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(event_id) REFERENCES ingested_events(event_id)
  );

  CREATE TABLE IF NOT EXISTS execution_journal (
    run_id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('swarm_execute', 'event_ingest', 'webhook_intake', 'slack_notification', 'WEBHOOK_DUPLICATE_IGNORED')),
    ref_id TEXT NOT NULL,
    result_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id TEXT PRIMARY KEY,
    deal_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    expected_amount TEXT NOT NULL,
    rail_type TEXT NOT NULL CHECK(rail_type IN ('evm_usdc', 'wire')),
    currency TEXT NOT NULL CHECK(currency IN ('USDC', 'USD')),
    authorized_wallets_canonical TEXT NOT NULL,
    expected_wire_sender_ref TEXT
  );

  CREATE TABLE IF NOT EXISTS deals (
    deal_id TEXT PRIMARY KEY,
    receiving_account_ref TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS payment_receipts (
    receipt_id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    deal_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    rail_type TEXT NOT NULL,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL,
    payer_ref TEXT NOT NULL,
    receipt_ref TEXT NOT NULL,
    to_account_ref TEXT NOT NULL,
    chain_id INTEGER,
    source_event_id TEXT NOT NULL,
    observed_at TEXT,
    UNIQUE(subscription_id),
    UNIQUE(receipt_ref)
  );

  CREATE TABLE IF NOT EXISTS issuance_intents (
    issuance_id TEXT PRIMARY KEY,
    subscription_id TEXT NOT NULL,
    receipt_id TEXT NOT NULL,
    issuance_plan_hash TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

export function ensureServiceSchema(db: DatabaseSync): void {
  db.exec(SCHEMA_SQL);
}
