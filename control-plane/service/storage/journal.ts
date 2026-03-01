import type { DatabaseSync } from 'node:sqlite';

import { sha256 } from '../../finance/determinism.ts';

export type JournalType = 'swarm_execute' | 'event_ingest' | 'webhook_intake' | 'slack_notification';

export interface JournalRecord {
  run_id: string;
  type: JournalType;
  ref_id: string;
  result_hash: string;
  created_at: string;
}

export function computeSwarmRunId(canonicalResult: string): string {
  return sha256(`swarm_execute\n${canonicalResult}`);
}

export function computeEventIngestRunId(source: string, eventId: string, canonicalHandlerResult: string): string {
  return sha256(`event_ingest\n${source}\n${eventId}\n${canonicalHandlerResult}`);
}

export function appendJournalEntry(db: DatabaseSync, entry: JournalRecord): void {
  db.prepare(`
    INSERT INTO execution_journal (run_id, type, ref_id, result_hash, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(entry.run_id, entry.type, entry.ref_id, entry.result_hash, entry.created_at);
}

export function countJournalByRefId(db: DatabaseSync, refId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM execution_journal WHERE ref_id = ?').get(refId) as { count: number };
  return row.count;
}

export function getJournalByRunId(db: DatabaseSync, runId: string): JournalRecord | null {
  const row = db.prepare('SELECT * FROM execution_journal WHERE run_id = ?').get(runId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    run_id: row.run_id as string,
    type: row.type as JournalType,
    ref_id: row.ref_id as string,
    result_hash: row.result_hash as string,
    created_at: row.created_at as string
  };
}

export function hasJournalRunId(db: DatabaseSync, runId: string, type?: JournalType): boolean {
  const row = type
    ? db.prepare('SELECT 1 AS present FROM execution_journal WHERE run_id = ? AND type = ?').get(runId, type)
    : db.prepare('SELECT 1 AS present FROM execution_journal WHERE run_id = ?').get(runId);
  return row !== undefined;
}
