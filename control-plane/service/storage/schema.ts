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
    type TEXT NOT NULL CHECK(type IN ('swarm_execute', 'event_ingest')),
    ref_id TEXT NOT NULL,
    result_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`;

export function ensureServiceSchema(db: DatabaseSync): void {
  db.exec(SCHEMA_SQL);
}
