import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createCockpitRunRepo } from './run.repo.ts';
import type { Run } from './run.types.ts';

const TMP_DIR = path.resolve('control-plane/__tests__/tmp-cockpit-run-repo');
const STORAGE_PATH = path.join(TMP_DIR, 'cockpit-runs.json');
const UNRELATED_PATH = path.join(TMP_DIR, 'unrelated.json');

function run(input: Pick<Run, 'projectId' | 'goalId' | 'teamId' | 'runId' | 'attemptIndex'>): Run {
  return {
    runId: input.runId,
    projectId: input.projectId,
    teamId: input.teamId,
    goalId: input.goalId,
    executionMode: 'structured',
    status: 'created',
    attemptIndex: input.attemptIndex
  };
}

describe('cockpit run repo', () => {
  beforeEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.writeFileSync(UNRELATED_PATH, '{"stable":true}\n', 'utf8');
  });

  it('creates and fetches runs deterministically', () => {
    const repo = createCockpitRunRepo({ storagePath: STORAGE_PATH });
    const created = repo.createRun(
      run({
        runId: 'run-1',
        projectId: 'core-app',
        teamId: 'dev-team',
        goalId: 'goal-a',
        attemptIndex: 1
      })
    );

    const fetched = repo.getRun(created.runId);
    expect(fetched).toEqual(created);
    expect(repo.listRuns()).toEqual([created]);
  });

  it('lists by project in deterministic ordering and scope', () => {
    const repo = createCockpitRunRepo({ storagePath: STORAGE_PATH });
    repo.createRun(run({ runId: 'run-2', projectId: 'core-app', teamId: 'dev-team', goalId: 'goal-b', attemptIndex: 1 }));
    repo.createRun(run({ runId: 'run-1', projectId: 'core-app', teamId: 'dev-team', goalId: 'goal-a', attemptIndex: 1 }));
    repo.createRun(run({ runId: 'run-9', projectId: 'alt-app', teamId: 'dev-team', goalId: 'goal-z', attemptIndex: 1 }));

    const coreRuns = repo.listRunsByProject('core-app');
    expect(coreRuns.map((entry) => entry.runId)).toEqual(['run-1', 'run-2']);
    expect(coreRuns.every((entry) => entry.projectId === 'core-app')).toBe(true);
  });

  it('keeps unrelated structures unchanged and reads stable across repeated calls', () => {
    const repo = createCockpitRunRepo({ storagePath: STORAGE_PATH });
    const unrelatedBefore = fs.readFileSync(UNRELATED_PATH, 'utf8');

    repo.createRun(run({ runId: 'run-1', projectId: 'core-app', teamId: 'dev-team', goalId: 'goal-a', attemptIndex: 1 }));

    const firstRead = repo.listRuns();
    const secondRead = repo.listRuns();
    const unrelatedAfter = fs.readFileSync(UNRELATED_PATH, 'utf8');

    expect(firstRead).toEqual(secondRead);
    expect(unrelatedAfter).toBe(unrelatedBefore);
  });
});
