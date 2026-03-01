import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { validateStartupInvariants } from './startup-invariants.ts';

function createFixtureDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'service-startup-invariants-'));
}

describe('startup invariants', () => {
  let fixtureDir = '';
  let previousCwd = '';

  beforeEach(() => {
    fixtureDir = createFixtureDir();
    previousCwd = process.cwd();
    process.chdir(fixtureDir);
    fs.mkdirSync(path.join('control-plane', 'service'), { recursive: true });
    fs.writeFileSync(path.join('control-plane', 'service', 'index.ts'), 'export {}\n', 'utf8');
  });

  afterEach(() => {
    process.chdir(previousCwd);
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it('throws deterministic error for root .env.example', () => {
    fs.writeFileSync('.env.example', 'X=1\n', 'utf8');

    expect(() => validateStartupInvariants()).toThrowError('STARTUP_INVARIANT_FAILED: ROOT_ENV_EXAMPLE_PRESENT');
  });

  it('throws deterministic error for root Dockerfile', () => {
    fs.writeFileSync('Dockerfile', 'FROM node:22\n', 'utf8');

    expect(() => validateStartupInvariants()).toThrowError('STARTUP_INVARIANT_FAILED: ROOT_DOCKERFILE_PRESENT');
  });

  it('throws deterministic error when service namespace is missing', () => {
    fs.rmSync(path.join('control-plane', 'service', 'index.ts'));

    expect(() => validateStartupInvariants()).toThrowError('STARTUP_INVARIANT_FAILED: SERVICE_NAMESPACE_INVALID');
  });

  it('throws deterministic error when journal directory is missing', () => {
    expect(() => validateStartupInvariants({ dbPath: './missing-dir/smartfunds.db' }))
      .toThrowError('STARTUP_INVARIANT_FAILED: JOURNAL_DIR_MISSING');
  });

  it('passes for valid layout', () => {
    expect(() => validateStartupInvariants({ dbPath: ':memory:' })).not.toThrow();
  });
});
