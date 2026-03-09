import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { listArtifactsForRun } from './artifact-listing.ts';

const missionId = 's84-artifacts-mission';
const runId = 'run_test_0001';
const baseDir = path.join('artifacts', missionId, runId);

afterEach(() => {
  fs.rmSync(path.join('artifacts', missionId), { recursive: true, force: true });
});

describe('artifact listing', () => {
  it('T-A84-1 lists files for a run in deterministic order', () => {
    fs.mkdirSync(baseDir, { recursive: true });
    fs.writeFileSync(path.join(baseDir, 'zeta.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(baseDir, 'alpha.csv'), 'a,b\n', 'utf8');

    expect(listArtifactsForRun({ missionId, runId })).toEqual(['alpha.csv', 'zeta.json']);
  });

  it('T-A84-2 returns empty list when run directory is absent', () => {
    expect(listArtifactsForRun({ missionId, runId })).toEqual([]);
  });
});
