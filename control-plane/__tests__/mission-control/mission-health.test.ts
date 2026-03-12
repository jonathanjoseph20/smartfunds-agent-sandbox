import { describe, expect, it } from 'vitest';

import { deriveMissionHealthState } from '../../mission-control/mission-health.ts';
import type { MissionProgressSummary } from '../../mission-control/mission-run-types.ts';

function progress(overrides: Partial<MissionProgressSummary>): MissionProgressSummary {
  return {
    totalTaskCount: 2,
    pendingTaskCount: 0,
    readyTaskCount: 0,
    runningTaskCount: 0,
    retryingTaskCount: 0,
    completedTaskCount: 0,
    failedTaskCount: 0,
    blockedTaskCount: 0,
    skippedTaskCount: 0,
    completionPercent: 0,
    criticalPathState: 'clear',
    remainingBlockingNodes: [],
    ...overrides,
  };
}

describe('mission health', () => {
  it('T-MC-H1 derives healthy state', () => {
    expect(deriveMissionHealthState({
      progressSummary: progress({ completedTaskCount: 2, completionPercent: 100 }),
      completionState: 'completed',
      escalationCount: 0,
    })).toBe('healthy');
  });

  it('T-MC-H2 derives degraded state', () => {
    expect(deriveMissionHealthState({
      progressSummary: progress({ retryingTaskCount: 1 }),
      completionState: 'in_progress',
      escalationCount: 1,
      orchestrationCycleState: 'incomplete',
    })).toBe('degraded');
  });

  it('T-MC-H3 derives blocked state', () => {
    expect(deriveMissionHealthState({
      progressSummary: progress({ blockedTaskCount: 1, remainingBlockingNodes: ['node-a'] }),
      completionState: 'blocked',
      escalationCount: 0,
    })).toBe('blocked');
  });

  it('T-MC-H4 derives failed state', () => {
    expect(deriveMissionHealthState({
      progressSummary: progress({ failedTaskCount: 1 }),
      completionState: 'failed',
      escalationCount: 0,
    })).toBe('failed');
  });
});
