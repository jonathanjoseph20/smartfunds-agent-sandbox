import { describe, expect, it } from 'vitest';

import { createActivationDispatchAttempt } from '../../mission-control/activation-dispatch-attempt.ts';
import { deriveActivationDispatchAttemptId } from '../../mission-control/activation-runtime-integration-identity.ts';
import type { ExecutionActivationRecord } from '../../mission-control/mission-execution-activation-types.ts';

function activationRecord(input: Partial<ExecutionActivationRecord> = {}): ExecutionActivationRecord {
  return {
    executionActivationRecordId: 'activation-1',
    executionRequestRecordId: 'request-1',
    missionExecutionCoordinationPlanId: 'plan-1',
    executionIntentId: 'intent-1',
    targetExecutionDomain: 'mission_execution',
    priority: 'high',
    state: 'submitted',
    outcome: 'submitted',
    ...input,
  };
}

describe('activation dispatch attempt', () => {
  it('T-ARI-A1 deterministic identity and attempt creation remain stable', () => {
    const one = createActivationDispatchAttempt({ activationRecord: activationRecord() });
    const two = createActivationDispatchAttempt({ activationRecord: activationRecord() });

    expect(two).toEqual(one);
    expect(two.activationDispatchAttemptId).toBe(deriveActivationDispatchAttemptId({
      executionActivationRecordId: 'activation-1',
      executionRequestRecordId: 'request-1',
      targetRuntimeDomain: 'mission_execution',
      priority: 'high',
    }));
  });

  it('T-ARI-A2 state mapping preserves additive runtime integration semantics', () => {
    const completed = createActivationDispatchAttempt({
      activationRecord: activationRecord({ state: 'completed', outcome: 'completed' }),
    });

    expect(completed.state).toBe('completed');
    expect(completed.outcome).toBe('completed');
  });
});
