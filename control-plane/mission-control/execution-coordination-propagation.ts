import {
  deriveExecutionCoordinationPropagationId,
  uniqueSortedStrings,
} from './runtime-outcome-propagation-identity.ts';
import type {
  ExecutionCoordinationPropagation,
  ExecutionCoordinationPropagationClass,
  RuntimeOutcomePropagationRecordState,
} from './runtime-outcome-propagation-types.ts';

export function deriveExecutionCoordinationPropagationClass(input: {
  coordinationStatus: string;
  coordinationOutcome: string;
}): ExecutionCoordinationPropagationClass {
  if (input.coordinationStatus === 'execution_completed') {
    return input.coordinationOutcome === 'partially_completed'
      ? 'coordination_partially_completed'
      : 'coordination_completed';
  }
  if (input.coordinationStatus === 'execution_failed') {
    return 'coordination_failed';
  }
  if (input.coordinationStatus === 'execution_deferred') {
    return 'coordination_deferred';
  }
  if (input.coordinationStatus === 'inconclusive') {
    return 'coordination_inconclusive';
  }
  return 'coordination_partially_completed';
}

export function deriveExecutionCoordinationPropagationState(input: {
  propagationClass: ExecutionCoordinationPropagationClass;
}): RuntimeOutcomePropagationRecordState {
  if (input.propagationClass === 'coordination_inconclusive') {
    return 'inconclusive';
  }
  if (input.propagationClass === 'coordination_partially_completed') {
    return 'active';
  }
  return 'resolved';
}

export function createExecutionCoordinationPropagation(input: {
  runtimeOutcomePropagationRecordId: string;
  missionExecutionCoordinationPlanId: string;
  coordinationStatus: string;
  coordinationOutcome: string;
  reasonTokens?: string[];
}): ExecutionCoordinationPropagation {
  const propagationClass = deriveExecutionCoordinationPropagationClass({
    coordinationStatus: input.coordinationStatus,
    coordinationOutcome: input.coordinationOutcome,
  });

  const reasonTokens = uniqueSortedStrings([
    `coordination_status:${input.coordinationStatus}`,
    `coordination_outcome:${input.coordinationOutcome}`,
    `propagation_class:${propagationClass}`,
    ...(input.reasonTokens ?? []),
  ]);

  return {
    executionCoordinationPropagationId: deriveExecutionCoordinationPropagationId({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      propagationClass,
      reasonTokens,
    }),
    runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
    missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
    propagationClass,
    reasonTokens,
    state: deriveExecutionCoordinationPropagationState({ propagationClass }),
  };
}
