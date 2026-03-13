import {
  deriveExecutionIntentId,
  uniqueSortedStrings,
} from './mission-execution-coordination-identity.ts';
import type {
  ExecutionIntent,
  ExecutionIntentState,
  MissionOrchestrationExecutionMapping,
} from './mission-execution-coordination-types.ts';
import type { MissionControlOrchestrationActionItem } from './mission-control-orchestration-types.ts';

function intentStateForActionState(actionState: MissionControlOrchestrationActionItem['state']): ExecutionIntentState {
  if (actionState === 'completed') {
    return 'completed';
  }
  if (actionState === 'active') {
    return 'active';
  }
  if (actionState === 'deferred') {
    return 'deferred';
  }
  if (actionState === 'blocked') {
    return 'failed';
  }
  if (actionState === 'inconclusive') {
    return 'inconclusive';
  }
  return 'queued';
}

export function deriveExecutionIntents(input: {
  missionExecutionCoordinationPlanId: string;
  mappings: MissionOrchestrationExecutionMapping[];
  actionItems: MissionControlOrchestrationActionItem[];
}): ExecutionIntent[] {
  const actionById = new Map(input.actionItems.map((entry) => [entry.missionControlOrchestrationActionItemId, entry]));

  const intents = input.mappings.map((mapping) => {
    const actionItem = actionById.get(mapping.missionControlOrchestrationActionItemId);
    const linkedActionItemIds = [mapping.missionControlOrchestrationActionItemId];
    const reasonTokens = uniqueSortedStrings([
      ...mapping.reasonTokens,
      ...(actionItem?.reasonTokens ?? []),
    ]);

    return {
      executionIntentId: deriveExecutionIntentId({
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
        intentClass: mapping.executionIntentClass,
        linkedActionItemIds,
        reasonTokens,
      }),
      missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
      intentClass: mapping.executionIntentClass,
      reasonTokens,
      linkedActionItemIds,
      state: intentStateForActionState(actionItem?.state ?? 'pending'),
    } satisfies ExecutionIntent;
  });

  return intents
    .sort((left, right) => left.executionIntentId.localeCompare(right.executionIntentId));
}
