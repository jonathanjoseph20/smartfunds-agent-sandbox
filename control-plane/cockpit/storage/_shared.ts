import type { DatabaseSync } from 'node:sqlite';

export function one<T>(db: DatabaseSync, sql: string, ...args: unknown[]): T | null {
  const row = db.prepare(sql).get(...args) as T | undefined;
  return row ?? null;
}

export function all<T>(db: DatabaseSync, sql: string, ...args: unknown[]): T[] {
  return db.prepare(sql).all(...args) as T[];
}

export function nextCounterId(db: DatabaseSync, prefix: string): string {
  const existing = db.prepare('SELECT next_value FROM cockpit_id_counters WHERE prefix = ?').get(prefix) as { next_value: number } | undefined;
  if (!existing) {
    db.prepare('INSERT INTO cockpit_id_counters (prefix, next_value) VALUES (?, 2)').run(prefix);
    return `${prefix}-1`;
  }

  const nextValue = existing.next_value;
  db.prepare('UPDATE cockpit_id_counters SET next_value = ? WHERE prefix = ?').run(nextValue + 1, prefix);
  return `${prefix}-${String(nextValue)}`;
}

export interface IdempotencyRecord {
  scope: string;
  idempotency_key: string;
  resource_type: string;
  resource_id: string;
}

export function getIdempotencyRecord(db: DatabaseSync, scope: string, key: string): IdempotencyRecord | null {
  return one<IdempotencyRecord>(
    db,
    'SELECT scope, idempotency_key, resource_type, resource_id FROM cockpit_idempotency WHERE scope = ? AND idempotency_key = ?',
    scope,
    key
  );
}

export function insertIdempotencyRecord(
  db: DatabaseSync,
  scope: string,
  key: string,
  resourceType: string,
  resourceId: string
): void {
  db.prepare(
    'INSERT INTO cockpit_idempotency (scope, idempotency_key, resource_type, resource_id) VALUES (?, ?, ?, ?)'
  ).run(scope, key, resourceType, resourceId);
}

export function withTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
