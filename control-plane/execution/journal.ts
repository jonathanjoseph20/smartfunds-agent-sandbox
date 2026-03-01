import type { DatabaseSync } from 'node:sqlite';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import type { RunState } from './runState.ts';
import type { ExecutionRun, ExecutionRunEvent } from './types.ts';

const EXECUTION_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS execution_runs (
    run_id TEXT PRIMARY KEY,
    run_type TEXT NOT NULL CHECK(run_type = 'swarm'),
    project_id TEXT NOT NULL,
    swarm_id TEXT NOT NULL,
    mode TEXT NOT NULL CHECK(mode IN ('structured', 'autonomous')),
    run_index INTEGER NOT NULL,
    intent TEXT NOT NULL,
    args_canonical TEXT NOT NULL,
    state TEXT NOT NULL,
    branch_name TEXT NOT NULL,
    pr_number INTEGER,
    pr_url TEXT,
    result_canonical TEXT,
    result_hash TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS execution_run_events (
    event_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    state TEXT NOT NULL,
    payload_canonical TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    attempt_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES execution_runs(run_id)
  );
`;

export interface CreateRunInput {
  runType: 'swarm';
  projectId: string;
  swarmId: string;
  mode: 'structured' | 'autonomous';
  runIndex: number;
  intent: string;
  branchName: string;
}

export interface ListRunsFilter {
  projectId?: string;
  swarmId?: string;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function mapRunRow(row: Record<string, unknown>): ExecutionRun {
  return {
    runId: row.run_id as string,
    runType: row.run_type as 'swarm',
    projectId: row.project_id as string,
    swarmId: row.swarm_id as string,
    mode: row.mode as 'structured' | 'autonomous',
    runIndex: row.run_index as number,
    intent: row.intent as string,
    argsCanonical: row.args_canonical as string,
    state: row.state as RunState,
    branchName: row.branch_name as string,
    prNumber: asOptionalNumber(row.pr_number),
    prUrl: asOptionalString(row.pr_url),
    resultCanonical: asOptionalString(row.result_canonical),
    resultHash: asOptionalString(row.result_hash),
    errorCode: asOptionalString(row.error_code),
    errorMessage: asOptionalString(row.error_message)
  };
}

function buildRunRecord(input: CreateRunInput): { runId: string; argsCanonical: string; branchName: string } {
  const argsCanonical = canonicalStringify({
    runType: input.runType,
    projectId: input.projectId,
    swarmId: input.swarmId,
    mode: input.mode,
    runIndex: input.runIndex,
    intent: input.intent
  });

  const runId = sha256(`swarm_run\n${argsCanonical}`);
  return { runId, argsCanonical, branchName: input.branchName };
}

export function computeExecutionRunId(argsCanonical: string): string {
  return sha256(`swarm_run\n${argsCanonical}`);
}

export function computeExecutionEventId(runId: string, state: RunState, attemptIndex: number, payloadHash: string): string {
  return sha256(`${runId}\n${state}\n${attemptIndex}\n${payloadHash}`);
}

export function createExecutionJournal(db: DatabaseSync, now: () => string = () => new Date().toISOString()) {
  db.exec(EXECUTION_SCHEMA_SQL);

  function createRun(input: CreateRunInput): { runId: string; argsCanonical: string } {
    const record = buildRunRecord(input);
    const existing = getRun(record.runId);
    if (existing) {
      return { runId: existing.runId, argsCanonical: existing.argsCanonical };
    }

    db.prepare(`
      INSERT INTO execution_runs (
        run_id,
        run_type,
        project_id,
        swarm_id,
        mode,
        run_index,
        intent,
        args_canonical,
        state,
        branch_name,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.runId,
      input.runType,
      input.projectId,
      input.swarmId,
      input.mode,
      input.runIndex,
      input.intent,
      record.argsCanonical,
      'CREATED',
      record.branchName,
      now()
    );

    appendRunEvent(record.runId, 'CREATED', {
      branchName: record.branchName,
      mode: input.mode,
      projectId: input.projectId,
      runIndex: input.runIndex,
      swarmId: input.swarmId
    });

    return { runId: record.runId, argsCanonical: record.argsCanonical };
  }

  function getRun(runId: string): ExecutionRun | null {
    const row = db.prepare('SELECT * FROM execution_runs WHERE run_id = ?').get(runId) as Record<string, unknown> | undefined;
    return row ? mapRunRow(row) : null;
  }

  function appendRunEvent(runId: string, state: RunState, payload: unknown): ExecutionRunEvent {
    const payloadCanonical = canonicalStringify(payload);
    const payloadHash = sha256(payloadCanonical);
    const attemptRow = db.prepare(
      'SELECT COUNT(*) AS count FROM execution_run_events WHERE run_id = ? AND state = ? AND payload_hash = ?'
    ).get(runId, state, payloadHash) as { count: number };
    const attemptIndex = attemptRow.count;
    const eventId = computeExecutionEventId(runId, state, attemptIndex, payloadHash);

    db.prepare(`
      INSERT INTO execution_run_events (
        event_id,
        run_id,
        state,
        payload_canonical,
        payload_hash,
        attempt_index,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      runId,
      state,
      payloadCanonical,
      payloadHash,
      attemptIndex,
      now()
    );

    return {
      eventId,
      runId,
      state,
      payloadCanonical,
      payloadHash,
      attemptIndex
    };
  }

  function listRunEvents(runId: string): ExecutionRunEvent[] {
    const rows = db.prepare(`
      SELECT event_id, run_id, state, payload_canonical, payload_hash, attempt_index
      FROM execution_run_events
      WHERE run_id = ?
      ORDER BY rowid ASC
    `).all(runId) as Array<Record<string, unknown>>;

    return rows.map((row) => ({
      eventId: row.event_id as string,
      runId: row.run_id as string,
      state: row.state as RunState,
      payloadCanonical: row.payload_canonical as string,
      payloadHash: row.payload_hash as string,
      attemptIndex: row.attempt_index as number
    }));
  }

  function setRunState(runId: string, state: RunState): void {
    db.prepare('UPDATE execution_runs SET state = ? WHERE run_id = ?').run(state, runId);
  }

  function setRunResult(runId: string, result: unknown): void {
    const resultCanonical = canonicalStringify(result);
    const resultHash = sha256(resultCanonical);

    db.prepare(`
      UPDATE execution_runs
      SET result_canonical = ?,
          result_hash = ?,
          error_code = NULL,
          error_message = NULL
      WHERE run_id = ?
    `).run(resultCanonical, resultHash, runId);

    const resultRecord = result as Record<string, unknown>;
    const prNumber = typeof resultRecord.prNumber === 'number' ? resultRecord.prNumber : null;
    const prUrl = typeof resultRecord.prUrl === 'string' ? resultRecord.prUrl : null;

    db.prepare('UPDATE execution_runs SET pr_number = ?, pr_url = ? WHERE run_id = ?').run(prNumber, prUrl, runId);
  }

  function setRunFailure(runId: string, error: { code: string; message: string }): void {
    db.prepare(`
      UPDATE execution_runs
      SET error_code = ?,
          error_message = ?,
          result_canonical = NULL,
          result_hash = NULL,
          state = 'FAILED'
      WHERE run_id = ?
    `).run(error.code, error.message, runId);
  }

  function listRuns(filter: ListRunsFilter = {}): ExecutionRun[] {
    const clauses: string[] = [];
    const values: string[] = [];

    if (typeof filter.projectId === 'string') {
      clauses.push('project_id = ?');
      values.push(filter.projectId);
    }

    if (typeof filter.swarmId === 'string') {
      clauses.push('swarm_id = ?');
      values.push(filter.swarmId);
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = db.prepare(`
      SELECT *
      FROM execution_runs
      ${whereClause}
      ORDER BY run_id ASC
    `).all(...values) as Array<Record<string, unknown>>;

    return rows.map(mapRunRow);
  }

  return {
    createRun,
    getRun,
    appendRunEvent,
    listRunEvents,
    setRunState,
    setRunResult,
    setRunFailure,
    listRuns
  };
}

export type ExecutionJournal = ReturnType<typeof createExecutionJournal>;
