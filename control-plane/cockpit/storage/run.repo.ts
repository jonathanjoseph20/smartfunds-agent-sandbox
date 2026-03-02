import type { DatabaseSync } from 'node:sqlite';

import type { Run } from '../models/run.ts';
import { all, one } from './_shared.ts';

interface RunRow {
  run_id: string;
  project_id: string;
  goal_id: string;
  run_index: number;
  status: string;
  idempotency_key: string | null;
}

function toRun(row: RunRow): Run {
  return {
    runId: row.run_id,
    projectId: row.project_id,
    goalId: row.goal_id,
    runIndex: row.run_index,
    status: row.status,
    idempotencyKey: row.idempotency_key
  };
}

export function createRun(db: DatabaseSync, run: Run): Run {
  db.prepare(
    `INSERT INTO cockpit_runs (run_id, project_id, goal_id, run_index, status, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(run.runId, run.projectId, run.goalId, run.runIndex, run.status, run.idempotencyKey);
  return run;
}

export function getRunById(db: DatabaseSync, runId: string): Run | null {
  const row = one<RunRow>(
    db,
    'SELECT run_id, project_id, goal_id, run_index, status, idempotency_key FROM cockpit_runs WHERE run_id = ?',
    runId
  );
  return row ? toRun(row) : null;
}

export function getRunByGoalAndIdempotencyKey(db: DatabaseSync, goalId: string, key: string): Run | null {
  const row = one<RunRow>(
    db,
    `SELECT run_id, project_id, goal_id, run_index, status, idempotency_key
     FROM cockpit_runs
     WHERE goal_id = ? AND idempotency_key = ?`,
    goalId,
    key
  );
  return row ? toRun(row) : null;
}

export function listRunsByGoalId(db: DatabaseSync, goalId: string): Run[] {
  return all<RunRow>(
    db,
    `SELECT run_id, project_id, goal_id, run_index, status, idempotency_key
     FROM cockpit_runs
     WHERE goal_id = ?
     ORDER BY run_index DESC, run_id ASC`,
    goalId
  ).map(toRun);
}

export function nextRunIndex(db: DatabaseSync, goalId: string): number {
  const row = db.prepare('SELECT COALESCE(MAX(run_index), -1) AS max_idx FROM cockpit_runs WHERE goal_id = ?').get(goalId) as { max_idx: number };
  return row.max_idx + 1;
}

export function updateRunStatus(db: DatabaseSync, runId: string, status: string): void {
  db.prepare('UPDATE cockpit_runs SET status = ? WHERE run_id = ?').run(status, runId);
}
