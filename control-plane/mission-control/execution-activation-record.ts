import {
  deriveExecutionActivationRecordId,
} from './mission-execution-activation-identity.ts';
import type {
  ExecutionActivationOutcomeValue,
  ExecutionActivationRecord,
  ExecutionActivationRecordState,
} from './mission-execution-activation-types.ts';
import type { ExecutionRequestRecord } from './mission-execution-coordination-types.ts';

function stateFromRequestState(requestState: ExecutionRequestRecord['state']): ExecutionActivationRecordState {
  if (requestState === 'completed') {
    return 'completed';
  }
  if (requestState === 'failed') {
    return 'failed';
  }
  if (requestState === 'deferred') {
    return 'deferred';
  }
  if (requestState === 'active') {
    return 'active';
  }
  if (requestState === 'submitted') {
    return 'submitted';
  }
  if (requestState === 'queued') {
    return 'queued';
  }
  if (requestState === 'inconclusive') {
    return 'inconclusive';
  }
  return 'created';
}

function outcomeFromState(state: ExecutionActivationRecordState): ExecutionActivationOutcomeValue {
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

export function createExecutionActivationRecord(input: {
  request: ExecutionRequestRecord;
}): ExecutionActivationRecord {
  const state = stateFromRequestState(input.request.state);

  return {
    executionActivationRecordId: deriveExecutionActivationRecordId({
      executionRequestRecordId: input.request.executionRequestRecordId,
      missionExecutionCoordinationPlanId: input.request.missionExecutionCoordinationPlanId,
      executionIntentId: input.request.executionIntentId,
      targetExecutionDomain: input.request.targetExecutionDomain,
      priority: input.request.priority,
    }),
    executionRequestRecordId: input.request.executionRequestRecordId,
    missionExecutionCoordinationPlanId: input.request.missionExecutionCoordinationPlanId,
    executionIntentId: input.request.executionIntentId,
    targetExecutionDomain: input.request.targetExecutionDomain,
    priority: input.request.priority,
    state,
    outcome: outcomeFromState(state),
  };
}

export function sortExecutionActivationRecords(records: ExecutionActivationRecord[]): ExecutionActivationRecord[] {
  return [...records].sort((left, right) => left.executionActivationRecordId.localeCompare(right.executionActivationRecordId));
}
