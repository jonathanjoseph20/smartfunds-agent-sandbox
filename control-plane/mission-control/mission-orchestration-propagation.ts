import {
  deriveMissionOrchestrationPropagationId,
  uniqueSortedStrings,
} from './runtime-outcome-propagation-identity.ts';
import type {
  MissionOrchestrationPropagation,
  MissionOrchestrationPropagationClass,
  RuntimeOutcomePropagationRecordState,
} from './runtime-outcome-propagation-types.ts';

export function deriveMissionOrchestrationPropagationClass(input: {
  orchestrationState: string;
  orchestrationOutcome: string;
}): MissionOrchestrationPropagationClass {
  if (input.orchestrationState === 'completed' || input.orchestrationOutcome === 'completed') {
    return 'orchestration_plan_completed';
  }
  if (input.orchestrationState === 'blocked' || input.orchestrationOutcome === 'blocked') {
    return 'orchestration_plan_blocked';
  }
  if (input.orchestrationState === 'inconclusive' || input.orchestrationOutcome === 'inconclusive') {
    return 'orchestration_inconclusive';
  }
  if (input.orchestrationOutcome === 'active' || input.orchestrationOutcome === 'stabilizing') {
    return 'orchestration_plan_partially_completed';
  }
  return 'orchestration_action_completed';
}

export function deriveMissionOrchestrationPropagationState(input: {
  propagationClass: MissionOrchestrationPropagationClass;
}): RuntimeOutcomePropagationRecordState {
  if (input.propagationClass === 'orchestration_inconclusive') {
    return 'inconclusive';
  }
  if (input.propagationClass === 'orchestration_plan_partially_completed') {
    return 'active';
  }
  return 'resolved';
}

export function createMissionOrchestrationPropagation(input: {
  runtimeOutcomePropagationRecordId: string;
  missionControlInterventionPlanId: string;
  orchestrationState: string;
  orchestrationOutcome: string;
  reasonTokens?: string[];
}): MissionOrchestrationPropagation {
  const propagationClass = deriveMissionOrchestrationPropagationClass({
    orchestrationState: input.orchestrationState,
    orchestrationOutcome: input.orchestrationOutcome,
  });

  const reasonTokens = uniqueSortedStrings([
    `orchestration_state:${input.orchestrationState}`,
    `orchestration_outcome:${input.orchestrationOutcome}`,
    `propagation_class:${propagationClass}`,
    ...(input.reasonTokens ?? []),
  ]);

  return {
    missionOrchestrationPropagationId: deriveMissionOrchestrationPropagationId({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      propagationClass,
      reasonTokens,
    }),
    runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
    missionControlInterventionPlanId: input.missionControlInterventionPlanId,
    propagationClass,
    reasonTokens,
    state: deriveMissionOrchestrationPropagationState({ propagationClass }),
  };
}
