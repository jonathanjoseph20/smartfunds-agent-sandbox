import { createRequire } from 'node:module';

import { ensureServiceSchema } from './schema.ts';

const require = createRequire(import.meta.url);

type NodeSqliteModule = typeof import('node:sqlite');
type DatabaseSyncInstance = InstanceType<NodeSqliteModule['DatabaseSync']>;

const DEFAULT_DB_PATH = './smartfunds.db';
const serviceDbRegistry = new Map<string, DatabaseSyncInstance>();

function loadNodeSqlite(): NodeSqliteModule {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-var-requires
  return require('node:sqlite');
}

export function getServiceDb(dbPath?: string): DatabaseSyncInstance {
  const resolvedPath = dbPath ?? process.env.SMARTFUNDS_DB_PATH ?? DEFAULT_DB_PATH;
  const existing = serviceDbRegistry.get(resolvedPath);
  if (existing) {
    return existing;
  }

  const { DatabaseSync } = loadNodeSqlite();
  const db = new DatabaseSync(resolvedPath);
  ensureServiceSchema(db);
  serviceDbRegistry.set(resolvedPath, db);
  return db;
}

export function clearServiceDbRegistryForTests(): void {
  serviceDbRegistry.clear();
}
