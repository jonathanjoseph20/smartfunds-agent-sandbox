import type { DatabaseSync } from 'node:sqlite';

import type { RunAttempt } from '../models/runAttempt.ts';
import { all, one } from './_shared.ts';

interface RunAttemptRow {
  run_id: string;
  attempt_index: number;
  status: string;
  idempotency_key: string | null;
}

function toRunAttempt(row: RunAttemptRow): RunAttempt {
  return {
    runId: row.run_id,
    attemptIndex: row.attempt_index,
    status: row.status,
    idempotencyKey: row.idempotency_key
  };
}

export function createRunAttempt(db: DatabaseSync, runAttempt: RunAttempt): RunAttempt {
  db.prepare(
    'INSERT INTO cockpit_run_attempts (run_id, attempt_index, status, idempotency_key) VALUES (?, ?, ?, ?)'
  ).run(runAttempt.runId, runAttempt.attemptIndex, runAttempt.status, runAttempt.idempotencyKey);
  return runAttempt;
}

export function getRunAttempt(db: DatabaseSync, runId: string, attemptIndex: number): RunAttempt | null {
  const row = one<RunAttemptRow>(
    db,
    `SELECT run_id, attempt_index, status, idempotency_key
     FROM cockpit_run_attempts
     WHERE run_id = ? AND attempt_index = ?`,
    runId,
    attemptIndex
  );
  return row ? toRunAttempt(row) : null;
}

export function getRunAttemptByIdempotencyKey(db: DatabaseSync, runId: string, key: string): RunAttempt | null {
  const row = one<RunAttemptRow>(
    db,
    `SELECT run_id, attempt_index, status, idempotency_key
     FROM cockpit_run_attempts
     WHERE run_id = ? AND idempotency_key = ?`,
    runId,
    key
  );
  return row ? toRunAttempt(row) : null;
}

export function listRunAttempts(db: DatabaseSync, runId: string): RunAttempt[] {
  return all<RunAttemptRow>(
    db,
    `SELECT run_id, attempt_index, status, idempotency_key
     FROM cockpit_run_attempts
     WHERE run_id = ?
     ORDER BY attempt_index ASC`,
    runId
  ).map(toRunAttempt);
}

export function nextAttemptIndex(db: DatabaseSync, runId: string): number {
  const row = db.prepare('SELECT COALESCE(MAX(attempt_index), -1) AS max_idx FROM cockpit_run_attempts WHERE run_id = ?').get(runId) as { max_idx: number };
  return row.max_idx + 1;
}

export function updateRunAttemptStatus(db: DatabaseSync, runId: string, attemptIndex: number, status: string): void {
  db.prepare('UPDATE cockpit_run_attempts SET status = ? WHERE run_id = ? AND attempt_index = ?').run(status, runId, attemptIndex);
}
