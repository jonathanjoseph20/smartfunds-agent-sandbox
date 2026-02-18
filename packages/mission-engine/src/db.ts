import { createRequire } from "node:module";

// Vite/Vitest can rewrite `import ... from "node:sqlite"` into bare `sqlite` during transform.
// Loading via `createRequire()` avoids that static import rewrite while still using native Node sqlite.
const require = createRequire(import.meta.url);

type NodeSqliteModule = typeof import("node:sqlite");

function loadNodeSqlite(): NodeSqliteModule {
  // Using require here is intentional (see note above).
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-var-requires
  return require("node:sqlite");
}

type DatabaseSyncInstance = InstanceType<NodeSqliteModule["DatabaseSync"]>;

const DEFAULT_DB_PATH = "./smartfunds.db";
const dbRegistry = new Map<string, DatabaseSyncInstance>();

export function getDb(dbPath?: string): DatabaseSyncInstance {
  const resolvedPath = dbPath ?? process.env.SMARTFUNDS_DB_PATH ?? DEFAULT_DB_PATH;

  const existing = dbRegistry.get(resolvedPath);
  if (existing) {
    return existing;
  }

  const { DatabaseSync } = loadNodeSqlite();
  const db = new DatabaseSync(resolvedPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS missions (
      id TEXT PRIMARY KEY,
      offering_name TEXT NOT NULL,
      asset_type TEXT NOT NULL,
      exemption_type TEXT NOT NULL CHECK(exemption_type = '506C'),
      target_raise REAL NOT NULL,
      jurisdiction TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      mission_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      actor TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      metadata TEXT
    );
  `);

  dbRegistry.set(resolvedPath, db);
  return db;
}
