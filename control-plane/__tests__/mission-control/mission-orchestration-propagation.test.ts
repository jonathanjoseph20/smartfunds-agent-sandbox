import { describe, expect, it } from 'vitest';

import {
  createMissionOrchestrationPropagation,
  deriveMissionOrchestrationPropagationClass,
} from '../../mission-control/mission-orchestration-propagation.ts';

describe('mission orchestration propagation', () => {
  it('T-ROP-O1 covers each mission orchestration propagation class', () => {
    expect(deriveMissionOrchestrationPropagationClass({ orchestrationState: 'completed', orchestrationOutcome: 'completed' })).toBe('orchestration_plan_completed');
    expect(deriveMissionOrchestrationPropagationClass({ orchestrationState: 'blocked', orchestrationOutcome: 'blocked' })).toBe('orchestration_plan_blocked');
    expect(deriveMissionOrchestrationPropagationClass({ orchestrationState: 'active', orchestrationOutcome: 'active' })).toBe('orchestration_plan_partially_completed');
    expect(deriveMissionOrchestrationPropagationClass({ orchestrationState: 'inconclusive', orchestrationOutcome: 'inconclusive' })).toBe('orchestration_inconclusive');
    expect(deriveMissionOrchestrationPropagationClass({ orchestrationState: 'queued', orchestrationOutcome: 'pending' })).toBe('orchestration_action_completed');
  });

  it('T-ROP-O2 deterministic creation', () => {
    const one = createMissionOrchestrationPropagation({
      runtimeOutcomePropagationRecordId: 'record-1',
      missionControlInterventionPlanId: 'plan-1',
      orchestrationState: 'completed',
      orchestrationOutcome: 'completed',
      reasonTokens: ['b', 'a'],
    });

    const two = createMissionOrchestrationPropagation({
      runtimeOutcomePropagationRecordId: 'record-1',
      missionControlInterventionPlanId: 'plan-1',
      orchestrationState: 'completed',
      orchestrationOutcome: 'completed',
      reasonTokens: ['a', 'b'],
    });

    expect(one).toEqual(two);
  });
});
