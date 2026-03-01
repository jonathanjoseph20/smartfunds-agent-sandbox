import type { DatabaseSync } from 'node:sqlite';

import { sha256 } from '../../finance/determinism.ts';

export type EventStatus = 'received' | 'processed' | 'failed';

export interface IngestedEventRecord {
  event_id: string;
  source: string;
  payload_canonical: string;
  status: EventStatus;
  error_code: string | null;
  created_at: string;
}

export function computeEventId(source: string, payloadCanonical: string): string {
  return sha256(`${source}\n${payloadCanonical}`);
}

export function getEventById(db: DatabaseSync, eventId: string): IngestedEventRecord | null {
  const row = db.prepare('SELECT * FROM ingested_events WHERE event_id = ?').get(eventId) as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  return {
    event_id: row.event_id as string,
    source: row.source as string,
    payload_canonical: row.payload_canonical as string,
    status: row.status as EventStatus,
    error_code: (row.error_code as string | null) ?? null,
    created_at: row.created_at as string
  };
}

export function insertReceivedEvent(db: DatabaseSync, event: {
  event_id: string;
  source: string;
  payload_canonical: string;
  created_at: string;
}): void {
  db.prepare(`
    INSERT INTO ingested_events (event_id, source, payload_canonical, status, error_code, created_at)
    VALUES (?, ?, ?, 'received', NULL, ?)
  `).run(event.event_id, event.source, event.payload_canonical, event.created_at);
}

export function updateEventStatus(db: DatabaseSync, eventId: string, status: EventStatus, errorCode: string | null): void {
  db.prepare('UPDATE ingested_events SET status = ?, error_code = ? WHERE event_id = ?').run(status, errorCode, eventId);
}

export function countEventsById(db: DatabaseSync, eventId: string): number {
  const row = db.prepare('SELECT COUNT(*) AS count FROM ingested_events WHERE event_id = ?').get(eventId) as { count: number };
  return row.count;
}
