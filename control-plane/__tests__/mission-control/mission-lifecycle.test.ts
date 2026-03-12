import { describe, expect, it } from 'vitest';

import {
  createMissionLifecycleTransition,
  isValidMissionLifecycleTransition,
} from '../../mission-control/mission-lifecycle.ts';
import type { MissionLifecycleState } from '../../mission-control/mission-coordination.ts';

const validTransitions: Array<[MissionLifecycleState, MissionLifecycleState]> = [
  ['created', 'ready'],
  ['ready', 'active'],
  ['active', 'paused'],
  ['paused', 'resuming'],
  ['resuming', 'active'],
  ['active', 'blocked'],
  ['blocked', 'active'],
  ['active', 'completed'],
  ['active', 'failed'],
  ['active', 'cancelled'],
  ['paused', 'cancelled'],
];

describe('mission lifecycle', () => {
  it('T-MCL1 validates lifecycle transition matrix', () => {
    for (const [fromState, toState] of validTransitions) {
      expect(isValidMissionLifecycleTransition({ fromState, toState })).toBe(true);
    }

    expect(isValidMissionLifecycleTransition({ fromState: 'created', toState: 'completed' })).toBe(false);
    expect(isValidMissionLifecycleTransition({ fromState: 'paused', toState: 'active' })).toBe(false);
    expect(isValidMissionLifecycleTransition({ fromState: 'failed', toState: 'archived' })).toBe(false);
  });

  it('T-MCL2 returns stable invalid transition error payload', () => {
    const result = createMissionLifecycleTransition({
      missionRunId: 'run-1',
      fromState: 'ready',
      toState: 'completed',
      reasonTokens: ['invalid'],
    });

    expect(result).toEqual({
      error: 'invalid_lifecycle_transition',
      fromState: 'ready',
      toState: 'completed',
      missionRunId: 'run-1',
    });
  });

  it('T-MCL3 produces deterministic transition identity', () => {
    const first = createMissionLifecycleTransition({
      missionRunId: 'run-1',
      fromState: 'active',
      toState: 'paused',
      reasonTokens: ['operator_pause'],
      linkedEscalationIds: ['esc-1'],
      linkedInterventionId: 'int-1',
    });

    const second = createMissionLifecycleTransition({
      missionRunId: 'run-1',
      fromState: 'active',
      toState: 'paused',
      reasonTokens: ['operator_pause'],
      linkedEscalationIds: ['esc-1'],
      linkedInterventionId: 'int-1',
    });

    if ('error' in first || 'error' in second) {
      throw new Error('EXPECTED_VALID_TRANSITION');
    }

    expect(first.missionLifecycleTransitionId).toBe(second.missionLifecycleTransitionId);
  });
});
