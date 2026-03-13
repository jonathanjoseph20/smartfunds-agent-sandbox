import {
  deriveMissionExecutionCoordinationOutcomeFromState,
  deriveMissionExecutionCoordinationPlanId,
  deriveMissionExecutionCoordinationPlanState,
  uniqueSortedStrings,
} from './mission-execution-coordination-identity.ts';
import type {
  ExecutionIntent,
  ExecutionRequestRecord,
  MissionExecutionCoordinationPlan,
} from './mission-execution-coordination-types.ts';

export function deriveMissionExecutionCoordinationPlan(input: {
  missionControlInterventionPlanId: string;
  displayName: string;
  strategyClass: string;
  priority: string;
  linkedActionItemIds: string[];
  intents: ExecutionIntent[];
  requests: ExecutionRequestRecord[];
}): MissionExecutionCoordinationPlan {
  const state = deriveMissionExecutionCoordinationPlanState({
    priority: input.priority,
    actionItemStates: [...input.intents.map((entry) => entry.state), ...input.requests.map((entry) => entry.state)],
  });

  return {
    missionExecutionCoordinationPlanId: deriveMissionExecutionCoordinationPlanId({
      missionControlInterventionPlanId: input.missionControlInterventionPlanId,
      strategyClass: input.strategyClass,
      priority: input.priority,
      linkedActionItemIds: input.linkedActionItemIds,
    }),
    missionControlInterventionPlanId: input.missionControlInterventionPlanId,
    displayName: `${input.displayName} Execution Coordination Plan`,
    strategyClass: input.strategyClass,
    executionIntentIds: uniqueSortedStrings(input.intents.map((entry) => entry.executionIntentId)),
    executionRequestIds: uniqueSortedStrings(input.requests.map((entry) => entry.executionRequestRecordId)),
    priority: input.priority,
    state,
    outcome: deriveMissionExecutionCoordinationOutcomeFromState(state),
  };
}
