import { describe, expect, it } from 'vitest';

import {
  createExecutionCoordinationPropagation,
  deriveExecutionCoordinationPropagationClass,
} from '../../mission-control/execution-coordination-propagation.ts';

describe('execution coordination propagation', () => {
  it('T-ROP-C1 covers each execution coordination propagation class', () => {
    expect(deriveExecutionCoordinationPropagationClass({ coordinationStatus: 'execution_completed', coordinationOutcome: 'completed' })).toBe('coordination_completed');
    expect(deriveExecutionCoordinationPropagationClass({ coordinationStatus: 'execution_completed', coordinationOutcome: 'partially_completed' })).toBe('coordination_partially_completed');
    expect(deriveExecutionCoordinationPropagationClass({ coordinationStatus: 'execution_failed', coordinationOutcome: 'failed' })).toBe('coordination_failed');
    expect(deriveExecutionCoordinationPropagationClass({ coordinationStatus: 'execution_deferred', coordinationOutcome: 'deferred' })).toBe('coordination_deferred');
    expect(deriveExecutionCoordinationPropagationClass({ coordinationStatus: 'inconclusive', coordinationOutcome: 'inconclusive' })).toBe('coordination_inconclusive');
  });

  it('T-ROP-C2 deterministic creation', () => {
    const one = createExecutionCoordinationPropagation({
      runtimeOutcomePropagationRecordId: 'record-1',
      missionExecutionCoordinationPlanId: 'plan-1',
      coordinationStatus: 'execution_completed',
      coordinationOutcome: 'completed',
      reasonTokens: ['b', 'a'],
    });

    const two = createExecutionCoordinationPropagation({
      runtimeOutcomePropagationRecordId: 'record-1',
      missionExecutionCoordinationPlanId: 'plan-1',
      coordinationStatus: 'execution_completed',
      coordinationOutcome: 'completed',
      reasonTokens: ['a', 'b'],
    });

    expect(one).toEqual(two);
  });
});
