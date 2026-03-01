import fs from 'node:fs';
import path from 'node:path';

export const STARTUP_INVARIANT_ERROR_PREFIX = 'STARTUP_INVARIANT_FAILED';

function fail(reasonCode: 'ROOT_ENV_EXAMPLE_PRESENT' | 'ROOT_DOCKERFILE_PRESENT' | 'JOURNAL_DIR_MISSING' | 'SERVICE_NAMESPACE_INVALID'): never {
  throw new Error(`${STARTUP_INVARIANT_ERROR_PREFIX}: ${reasonCode}`);
}

function isMemoryDbPath(dbPath: string): boolean {
  return dbPath === ':memory:';
}

export function validateStartupInvariants(options: {
  cwd?: string;
  dbPath?: string;
} = {}): void {
  const cwd = options.cwd ?? process.cwd();
  const dbPath = options.dbPath ?? process.env.SMARTFUNDS_DB_PATH ?? './smartfunds.db';

  if (fs.existsSync(path.join(cwd, '.env.example'))) {
    fail('ROOT_ENV_EXAMPLE_PRESENT');
  }

  if (fs.existsSync(path.join(cwd, 'Dockerfile'))) {
    fail('ROOT_DOCKERFILE_PRESENT');
  }

  if (!fs.existsSync(path.join(cwd, 'control-plane/service/index.ts'))) {
    fail('SERVICE_NAMESPACE_INVALID');
  }

  if (!isMemoryDbPath(dbPath)) {
    const journalDir = path.dirname(path.resolve(cwd, dbPath));
    if (!fs.existsSync(journalDir) || !fs.statSync(journalDir).isDirectory()) {
      fail('JOURNAL_DIR_MISSING');
    }
  }
}
