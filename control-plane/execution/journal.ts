import type { DatabaseSync } from 'node:sqlite';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import type { EnvelopeIdentityV1 } from './envelope.ts';
import { computeEnvelopeHash, computeRunId } from './envelope.ts';
import type { ErrorClass } from './error-classification.ts';
import { assertValidLifecycleTransition, type RunLifecycleState } from './run-lifecycle.ts';
import { computeAttemptId } from './retry.ts';
import type { RunEventRecord, RunRecord, RuntimeEvent } from './types.ts';

const EXECUTION_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS execution_runtime_runs (
    run_id TEXT PRIMARY KEY,
    envelope_hash TEXT NOT NULL UNIQUE,
    envelope_canonical TEXT NOT NULL,
    latest_state TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS execution_runtime_events (
    event_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    event_index INTEGER NOT NULL,
    attempt_index INTEGER NOT NULL,
    attempt_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    previous_state TEXT,
    next_state TEXT,
    envelope_hash TEXT NOT NULL,
    error_class TEXT,
    failure_signature TEXT,
    result_hash TEXT,
    artifact_type TEXT,
    artifact_value TEXT,
    artifacts_canonical TEXT,
    payload_hash TEXT NOT NULL,
    FOREIGN KEY(run_id) REFERENCES execution_runtime_runs(run_id),
    UNIQUE(run_id, event_index),
    UNIQUE(attempt_id, artifact_type, artifact_value)
  );
`;

function toAttemptIndex(runId: string, attemptId: string): number {
  const attempt0 = computeAttemptId(runId, 0);
  if (attemptId === attempt0) {
    return 0;
  }
  const attempt1 = computeAttemptId(runId, 1);
  if (attemptId === attempt1) {
    return 1;
  }
  throw new Error(`Invalid attemptId for runId=${runId}.`);
}

function mapEventRow(row: Record<string, unknown>): RunEventRecord {
  return {
    eventId: row.event_id as string,
    eventIndex: row.event_index as number,
    runId: row.run_id as string,
    attemptIndex: row.attempt_index as number,
    attemptId: row.attempt_id as string,
    eventType: row.event_type as RunEventRecord['eventType'],
    previousState: (row.previous_state as RunLifecycleState | null) ?? undefined,
    nextState: (row.next_state as RunLifecycleState | null) ?? undefined,
    envelopeHash: row.envelope_hash as string,
    errorClass: (row.error_class as ErrorClass | null) ?? undefined,
    failureSignature: (row.failure_signature as string | null) ?? undefined,
    resultHash: (row.result_hash as string | null) ?? undefined,
    artifactType: (row.artifact_type as string | null) ?? undefined,
    artifactValue: (row.artifact_value as string | null) ?? undefined,
    artifacts: row.artifacts_canonical
      ? JSON.parse(row.artifacts_canonical as string) as RunEventRecord['artifacts']
      : undefined
  };
}

function computeRuntimeEventId(input: {
  runId: string;
  attemptId: string;
  event: RuntimeEvent;
}): string {
  return sha256(canonicalStringify({
    runId: input.runId,
    attemptId: input.attemptId,
    eventType: input.event.eventType,
    previousState: input.event.previousState ?? null,
    nextState: input.event.nextState ?? null,
    envelopeHash: input.event.envelopeHash,
    errorClass: input.event.errorClass ?? null,
    failureSignature: input.event.failureSignature ?? null,
    resultHash: input.event.resultHash ?? null,
    artifactType: input.event.artifactType ?? null,
    artifactValue: input.event.artifactValue ?? null,
    artifacts: input.event.artifacts ?? null
  }));
}

function buildAttemptSummary(events: RunEventRecord[]): RunRecord['attempts'] {
  const byAttempt = new Map<number, RunRecord['attempts'][number]>();

  for (const event of events) {
    const current = byAttempt.get(event.attemptIndex) ?? {
      attemptIndex: event.attemptIndex,
      attemptId: event.attemptId,
      latestState: 'CREATED' as RunLifecycleState
    };
    if (event.eventType === 'STATE_TRANSITION' && event.nextState) {
      current.latestState = event.nextState;
    }
    byAttempt.set(event.attemptIndex, current);
  }

  return Array.from(byAttempt.values()).sort((left, right) => left.attemptIndex - right.attemptIndex);
}

export function createExecutionJournal(db: DatabaseSync) {
  db.exec(EXECUTION_SCHEMA_SQL);

  function createOrGetRun(envelopeIdentity: EnvelopeIdentityV1): { runId: string; envelopeHash: string } {
    const envelopeCanonical = canonicalStringify(envelopeIdentity);
    const envelopeHash = computeEnvelopeHash(envelopeIdentity);
    const existing = db.prepare(
      'SELECT run_id FROM execution_runtime_runs WHERE envelope_hash = ?'
    ).get(envelopeHash) as { run_id: string } | undefined;

    if (existing) {
      return { runId: existing.run_id, envelopeHash };
    }

    const runId = computeRunId(envelopeHash);
    db.prepare(`
      INSERT INTO execution_runtime_runs (
        run_id,
        envelope_hash,
        envelope_canonical,
        latest_state
      ) VALUES (?, ?, ?, ?)
    `).run(runId, envelopeHash, envelopeCanonical, 'CREATED');

    return { runId, envelopeHash };
  }

  function appendEvent(runId: string, attemptId: string, event: RuntimeEvent): number {
    const run = db.prepare('SELECT latest_state FROM execution_runtime_runs WHERE run_id = ?').get(runId) as
      | { latest_state: RunLifecycleState }
      | undefined;
    if (!run) {
      throw new Error(`Run not found: ${runId}`);
    }

    const eventId = computeRuntimeEventId({ runId, attemptId, event });
    const existingById = db.prepare(
      'SELECT event_index FROM execution_runtime_events WHERE event_id = ?'
    ).get(eventId) as { event_index: number } | undefined;
    if (existingById) {
      return existingById.event_index;
    }

    if (event.eventType === 'ARTIFACT_LINKED' && event.artifactType && event.artifactValue) {
      const existingArtifact = db.prepare(`
        SELECT event_index
        FROM execution_runtime_events
        WHERE attempt_id = ?
          AND artifact_type = ?
          AND artifact_value = ?
      `).get(attemptId, event.artifactType, event.artifactValue) as { event_index: number } | undefined;
      if (existingArtifact) {
        return existingArtifact.event_index;
      }
    }

    const attemptIndex = toAttemptIndex(runId, attemptId);
    if (event.eventType === 'STATE_TRANSITION') {
      if (!event.previousState || !event.nextState) {
        throw new Error('STATE_TRANSITION events require previousState and nextState.');
      }
      if (run.latest_state !== event.previousState) {
        throw new Error(`Invalid previous state: expected ${run.latest_state} but received ${event.previousState}.`);
      }
      assertValidLifecycleTransition(event.previousState, event.nextState);
    }

    const eventIndexRow = db.prepare(
      'SELECT COALESCE(MAX(event_index), -1) AS max_index FROM execution_runtime_events WHERE run_id = ?'
    ).get(runId) as { max_index: number };
    const eventIndex = eventIndexRow.max_index + 1;
    const payloadHash = sha256(canonicalStringify(event));

    db.prepare(`
      INSERT INTO execution_runtime_events (
        event_id,
        run_id,
        event_index,
        attempt_index,
        attempt_id,
        event_type,
        previous_state,
        next_state,
        envelope_hash,
        error_class,
        failure_signature,
        result_hash,
        artifact_type,
        artifact_value,
        artifacts_canonical,
        payload_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      runId,
      eventIndex,
      attemptIndex,
      attemptId,
      event.eventType,
      event.previousState ?? null,
      event.nextState ?? null,
      event.envelopeHash,
      event.errorClass ?? null,
      event.failureSignature ?? null,
      event.resultHash ?? null,
      event.artifactType ?? null,
      event.artifactValue ?? null,
      event.artifacts ? canonicalStringify(event.artifacts) : null,
      payloadHash
    );

    if (event.eventType === 'STATE_TRANSITION' && event.nextState) {
      db.prepare('UPDATE execution_runtime_runs SET latest_state = ? WHERE run_id = ?').run(event.nextState, runId);
    }

    return eventIndex;
  }

  function listRunEvents(runId: string): RunEventRecord[] {
    const rows = db.prepare(`
      SELECT *
      FROM execution_runtime_events
      WHERE run_id = ?
      ORDER BY event_index ASC
    `).all(runId) as Array<Record<string, unknown>>;

    return rows.map(mapEventRow);
  }

  function getRun(runId: string): RunRecord | null {
    const row = db.prepare(`
      SELECT run_id, envelope_hash, envelope_canonical, latest_state
      FROM execution_runtime_runs
      WHERE run_id = ?
    `).get(runId) as Record<string, unknown> | undefined;

    if (!row) {
      return null;
    }

    const events = listRunEvents(runId);
    return {
      runId: row.run_id as string,
      envelopeHash: row.envelope_hash as string,
      envelopeCanonical: row.envelope_canonical as string,
      latestState: row.latest_state as RunLifecycleState,
      attempts: buildAttemptSummary(events),
      events
    };
  }

  function getRunByEnvelopeHash(envelopeHash: string): RunRecord | null {
    const row = db.prepare('SELECT run_id FROM execution_runtime_runs WHERE envelope_hash = ?').get(envelopeHash) as
      | { run_id: string }
      | undefined;
    if (!row) {
      return null;
    }
    return getRun(row.run_id);
  }

  function listRuns(): RunRecord[] {
    const rows = db.prepare(`
      SELECT run_id
      FROM execution_runtime_runs
      ORDER BY run_id ASC
    `).all() as Array<{ run_id: string }>;
    return rows
      .map((row) => getRun(row.run_id))
      .filter((value): value is RunRecord => value !== null);
  }

  return {
    createOrGetRun,
    appendEvent,
    listRunEvents,
    getRun,
    getRunByEnvelopeHash,
    listRuns
  };
}

export type ExecutionJournal = ReturnType<typeof createExecutionJournal>;
