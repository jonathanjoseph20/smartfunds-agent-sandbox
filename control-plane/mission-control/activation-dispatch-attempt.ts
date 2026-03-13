import {
  deriveActivationDispatchAttemptId,
} from './activation-runtime-integration-identity.ts';
import type {
  ActivationAttemptOutcomeValue,
  ActivationDispatchAttempt,
  ActivationDispatchAttemptState,
} from './activation-runtime-integration-types.ts';
import type { ExecutionActivationRecord } from './mission-execution-activation-types.ts';

function attemptStateFromActivationState(state: ExecutionActivationRecord['state']): ActivationDispatchAttemptState {
  if (state === 'completed') {
    return 'completed';
  }
  if (state === 'failed') {
    return 'failed';
  }
  if (state === 'deferred') {
    return 'deferred';
  }
  if (state === 'active') {
    return 'active';
  }
  if (state === 'submitted') {
    return 'submitted';
  }
  if (state === 'queued') {
    return 'queued';
  }
  if (state === 'inconclusive') {
    return 'inconclusive';
  }
  return 'created';
}

function outcomeFromAttemptState(state: ActivationDispatchAttemptState): ActivationAttemptOutcomeValue {
  if (state === 'completed') {
    return 'completed';
  }
  if (state === 'failed') {
    return 'failed';
  }
  if (state === 'deferred') {
    return 'deferred';
  }
  if (state === 'active') {
    return 'active';
  }
  if (state === 'submitted') {
    return 'submitted';
  }
  if (state === 'inconclusive') {
    return 'inconclusive';
  }
  return 'pending';
}

export function createActivationDispatchAttempt(input: {
  activationRecord: ExecutionActivationRecord;
}): ActivationDispatchAttempt {
  const state = attemptStateFromActivationState(input.activationRecord.state);

  return {
    activationDispatchAttemptId: deriveActivationDispatchAttemptId({
      executionActivationRecordId: input.activationRecord.executionActivationRecordId,
      executionRequestRecordId: input.activationRecord.executionRequestRecordId,
      targetRuntimeDomain: input.activationRecord.targetExecutionDomain,
      priority: input.activationRecord.priority,
    }),
    executionActivationRecordId: input.activationRecord.executionActivationRecordId,
    executionRequestRecordId: input.activationRecord.executionRequestRecordId,
    targetRuntimeDomain: input.activationRecord.targetExecutionDomain,
    priority: input.activationRecord.priority,
    state,
    outcome: outcomeFromAttemptState(state),
  };
}

export function sortActivationDispatchAttempts(attempts: ActivationDispatchAttempt[]): ActivationDispatchAttempt[] {
  return [...attempts].sort((left, right) => left.activationDispatchAttemptId.localeCompare(right.activationDispatchAttemptId));
}
