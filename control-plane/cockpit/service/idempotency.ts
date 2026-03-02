import type { DatabaseSync } from 'node:sqlite';

import { getIdempotencyRecord, insertIdempotencyRecord } from '../storage/_shared.ts';

export function resolveIdempotentResource(
  db: DatabaseSync,
  scope: string,
  idempotencyKey: string | null
): { resourceType: string; resourceId: string } | null {
  if (!idempotencyKey) {
    return null;
  }

  const record = getIdempotencyRecord(db, scope, idempotencyKey);
  if (!record) {
    return null;
  }

  return {
    resourceType: record.resource_type,
    resourceId: record.resource_id
  };
}

export function saveIdempotencyResource(
  db: DatabaseSync,
  scope: string,
  idempotencyKey: string | null,
  resourceType: string,
  resourceId: string
): void {
  if (!idempotencyKey) {
    return;
  }

  insertIdempotencyRecord(db, scope, idempotencyKey, resourceType, resourceId);
}
