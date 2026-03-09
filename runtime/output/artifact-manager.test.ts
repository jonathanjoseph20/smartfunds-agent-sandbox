import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ensureArtifactDirectory, resolveArtifactDirectory } from './artifact-manager.ts';

const tmpRoot = '.test-artifacts';
const originalCwd = process.cwd();

afterEach(() => {
  process.chdir(originalCwd);
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runtime output artifact manager', () => {
  it('T-A82-1 resolves deterministic artifact directory path', () => {
    expect(resolveArtifactDirectory('rwa-market-analysis', 'run_smartfunds-core_0001')).toBe(
      path.join('artifacts', 'rwa-market-analysis', 'run_smartfunds-core_0001')
    );
  });

  it('T-A82-2 creates artifact directory deterministically and idempotently', () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    process.chdir(tmpRoot);

    const first = ensureArtifactDirectory('mission-1', 'run-1');
    const second = ensureArtifactDirectory('mission-1', 'run-1');

    expect(first).toBe(path.join('artifacts', 'mission-1', 'run-1'));
    expect(second).toBe(path.join('artifacts', 'mission-1', 'run-1'));
    expect(fs.existsSync(path.join('.', first))).toBe(true);
  });

  it('T-A82-3 rejects invalid missionId and runId path parts', () => {
    expect(() => resolveArtifactDirectory('../bad', 'run-1')).toThrow('ERR_ARTIFACT_PATH');
    expect(() => resolveArtifactDirectory('mission-1', 'run/1')).toThrow('ERR_ARTIFACT_PATH');
  });
});
