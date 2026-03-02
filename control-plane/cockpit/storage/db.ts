import type { DatabaseSync } from 'node:sqlite';

import { ensureCockpitSchema } from './schema.ts';

export function initializeCockpitStorage(db: DatabaseSync): void {
  db.exec('PRAGMA foreign_keys = ON;');
  ensureCockpitSchema(db);
}
