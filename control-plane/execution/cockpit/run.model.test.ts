import { describe, expect, it } from 'vitest';

import { sha256 } from '../../finance/determinism.ts';
import { computeRunId } from './run.model.ts';

describe('cockpit run model', () => {
  it('computes deterministic runId for identical inputs', () => {
    const input = {
      projectId: 'core-app',
      teamId: 'dev-team',
      goalId: 'goal-alpha',
      attemptIndex: 1
    };

    const runIdA = computeRunId(input);
    const runIdB = computeRunId(input);

    expect(runIdA).toBe(runIdB);
  });

  it('changes runId deterministically when attemptIndex changes', () => {
    const runIdAttempt1 = computeRunId({
      projectId: 'core-app',
      teamId: 'dev-team',
      goalId: 'goal-alpha',
      attemptIndex: 1
    });

    const runIdAttempt2 = computeRunId({
      projectId: 'core-app',
      teamId: 'dev-team',
      goalId: 'goal-alpha',
      attemptIndex: 2
    });

    expect(runIdAttempt1).not.toBe(runIdAttempt2);
    expect(runIdAttempt1).toBe(sha256('core-appdev-teamgoal-alpha1'));
    expect(runIdAttempt2).toBe(sha256('core-appdev-teamgoal-alpha2'));
  });
});
