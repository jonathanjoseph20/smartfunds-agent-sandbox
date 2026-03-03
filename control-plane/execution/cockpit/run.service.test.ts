import fs from 'node:fs';
import path from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { createCockpitRunRepo } from './run.repo.ts';
import { CockpitRunServiceError, createCockpitRunService } from './run.service.ts';

const TMP_DIR = path.resolve('control-plane/__tests__/tmp-cockpit-run-service');
const RUNS_PATH = path.join(TMP_DIR, 'cockpit-runs.json');
const GOALS_PATH = path.join(TMP_DIR, 'cockpit-goals.json');

function seedGoals(value: unknown): void {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  fs.writeFileSync(GOALS_PATH, `${JSON.stringify(value)}\n`, 'utf8');
}

describe('cockpit run service', () => {
  beforeEach(() => {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  it('increments attemptIndex deterministically for same project/team/goal', () => {
    seedGoals({
      goals: [
        {
          goalId: 'goal-a',
          projectId: 'core-app',
          teamId: 'dev-team'
        }
      ]
    });

    const repo = createCockpitRunRepo({ storagePath: RUNS_PATH });
    const service = createCockpitRunService({ repo, goalsPath: GOALS_PATH });
    const first = service.createRun({ projectId: 'core-app', teamId: 'dev-team', goalId: 'goal-a' });
    const second = service.createRun({ projectId: 'core-app', teamId: 'dev-team', goalId: 'goal-a' });

    expect(first.attemptIndex).toBe(1);
    expect(second.attemptIndex).toBe(2);
    expect(first.runId).not.toBe(second.runId);
  });

  it('throws stable failure for missing goal', () => {
    seedGoals({ goals: [] });

    const repo = createCockpitRunRepo({ storagePath: RUNS_PATH });
    const service = createCockpitRunService({ repo, goalsPath: GOALS_PATH });

    expect(() => service.createRun({ projectId: 'core-app', teamId: 'dev-team', goalId: 'missing-goal' }))
      .toThrowError(CockpitRunServiceError);
    expect(() => service.createRun({ projectId: 'core-app', teamId: 'dev-team', goalId: 'missing-goal' }))
      .toThrowError('Goal not found: missing-goal');
  });

  it('enforces goal scope against project and team inputs', () => {
    seedGoals({
      goals: [
        {
          goalId: 'goal-a',
          projectId: 'core-app',
          teamId: 'dev-team'
        }
      ]
    });

    const repo = createCockpitRunRepo({ storagePath: RUNS_PATH });
    const service = createCockpitRunService({ repo, goalsPath: GOALS_PATH });

    expect(() => service.createRun({ projectId: 'other-app', teamId: 'dev-team', goalId: 'goal-a' }))
      .toThrowError('Goal goal-a does not match project/team scope.');
  });
});
