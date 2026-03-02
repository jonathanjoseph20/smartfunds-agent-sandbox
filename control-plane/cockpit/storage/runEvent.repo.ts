import type { DatabaseSync } from 'node:sqlite';

import type { RunEvent } from '../models/runEvent.ts';
import { all } from './_shared.ts';

interface RunEventRow {
  run_id: string;
  attempt_index: number;
  event_seq: number;
  type: string;
  payload_json: string | null;
  envelope_hash: string | null;
}

function toRunEvent(row: RunEventRow): RunEvent {
  return {
    runId: row.run_id,
    attemptIndex: row.attempt_index,
    eventSeq: row.event_seq,
    type: row.type,
    payloadJson: row.payload_json,
    envelopeHash: row.envelope_hash
  };
}

export function appendRunEvent(db: DatabaseSync, event: RunEvent): RunEvent {
  db.prepare(
    `INSERT INTO cockpit_run_events (run_id, attempt_index, event_seq, type, payload_json, envelope_hash)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(event.runId, event.attemptIndex, event.eventSeq, event.type, event.payloadJson, event.envelopeHash);
  return event;
}

export function nextEventSeq(db: DatabaseSync, runId: string, attemptIndex: number): number {
  const row = db.prepare(
    'SELECT COALESCE(MAX(event_seq), -1) AS max_seq FROM cockpit_run_events WHERE run_id = ? AND attempt_index = ?'
  ).get(runId, attemptIndex) as { max_seq: number };
  return row.max_seq + 1;
}

export function listRunEvents(db: DatabaseSync, runId: string): RunEvent[] {
  return all<RunEventRow>(
    db,
    `SELECT run_id, attempt_index, event_seq, type, payload_json, envelope_hash
     FROM cockpit_run_events
     WHERE run_id = ?
     ORDER BY attempt_index ASC, event_seq ASC`,
    runId
  ).map(toRunEvent);
}

export function listRunEventsByAttempt(db: DatabaseSync, runId: string, attemptIndex: number): RunEvent[] {
  return all<RunEventRow>(
    db,
    `SELECT run_id, attempt_index, event_seq, type, payload_json, envelope_hash
     FROM cockpit_run_events
     WHERE run_id = ? AND attempt_index = ?
     ORDER BY event_seq ASC`,
    runId,
    attemptIndex
  ).map(toRunEvent);
}
