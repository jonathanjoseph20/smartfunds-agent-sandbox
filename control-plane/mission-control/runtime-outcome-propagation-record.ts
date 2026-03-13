import type { RuntimeOutcomePropagationOutcome } from './runtime-outcome-propagation-outcome.ts';
import {
  deriveRuntimeOutcomePropagationRecordId,
  uniqueSortedStrings,
} from './runtime-outcome-propagation-identity.ts';
import type {
  RuntimeOutcomePropagationClass,
  RuntimeOutcomePropagationRecord,
  RuntimeOutcomePropagationRecordState,
  RuntimeOutcomePropagationTargetLayer,
} from './runtime-outcome-propagation-types.ts';

export function deriveRuntimeOutcomePropagationClass(input: { runtimeStatus: string }): RuntimeOutcomePropagationClass {
  if (input.runtimeStatus === 'runtime_completed') {
    return 'runtime_completed';
  }
  if (input.runtimeStatus === 'runtime_failed') {
    return 'runtime_failed';
  }
  if (input.runtimeStatus === 'runtime_deferred') {
    return 'runtime_deferred';
  }
  if (input.runtimeStatus === 'inconclusive') {
    return 'runtime_inconclusive';
  }
  if (input.runtimeStatus === 'runtime_active' || input.runtimeStatus === 'dispatch_submitted') {
    return 'runtime_active';
  }
  return 'runtime_pending';
}

export function deriveRuntimeOutcomePropagationTargetLayer(input: { propagationClass: RuntimeOutcomePropagationClass }): RuntimeOutcomePropagationTargetLayer {
  if (input.propagationClass === 'runtime_pending' || input.propagationClass === 'runtime_active') {
    return 'execution_coordination_layer';
  }
  return 'mission_portfolio_layer';
}

export function deriveRuntimeOutcomePropagationRecordState(input: {
  propagationClass: RuntimeOutcomePropagationClass;
}): RuntimeOutcomePropagationRecordState {
  if (input.propagationClass === 'runtime_inconclusive') {
    return 'inconclusive';
  }
  if (input.propagationClass === 'runtime_pending' || input.propagationClass === 'runtime_active') {
    return 'active';
  }
  return 'resolved';
}

export function createRuntimeOutcomePropagationRecord(input: {
  activationDispatchAttemptId: string;
  executionActivationRecordId: string;
  executionRequestRecordId: string;
  runtimeStatus: string;
  outcome: RuntimeOutcomePropagationOutcome;
}): RuntimeOutcomePropagationRecord {
  const propagationClass = deriveRuntimeOutcomePropagationClass({ runtimeStatus: input.runtimeStatus });
  const targetLayer = deriveRuntimeOutcomePropagationTargetLayer({ propagationClass });

  return {
    runtimeOutcomePropagationRecordId: deriveRuntimeOutcomePropagationRecordId({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      executionActivationRecordId: input.executionActivationRecordId,
      executionRequestRecordId: input.executionRequestRecordId,
      propagationClass,
      targetLayer,
    }),
    activationDispatchAttemptId: input.activationDispatchAttemptId,
    executionActivationRecordId: input.executionActivationRecordId,
    executionRequestRecordId: input.executionRequestRecordId,
    propagationClass,
    targetLayer,
    state: deriveRuntimeOutcomePropagationRecordState({ propagationClass }),
    outcome: input.outcome,
  };
}

export function sortPropagationRecordIds(values: string[]): string[] {
  return uniqueSortedStrings(values);
}
