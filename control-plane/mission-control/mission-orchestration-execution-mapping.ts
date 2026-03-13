import {
  deriveMissionOrchestrationExecutionMappingId,
  uniqueSortedStrings,
} from './mission-execution-coordination-identity.ts';
import type { MissionControlOrchestrationActionItem } from './mission-control-orchestration-types.ts';
import type {
  ExecutionIntentClass,
  MissionOrchestrationExecutionMapping,
} from './mission-execution-coordination-types.ts';

const SEED_ACTION_TO_INTENT: Record<string, ExecutionIntentClass> = {
  maintain_watch_state: 'monitoring_task_intent',
  request_resolution_reassessment: 'reassessment_intent',
  request_portfolio_review: 'review_request_intent',
  stabilize_blocking_cluster: 'blocking_cluster_followup_intent',
};

function requestGenerationRuleForIntent(intentClass: ExecutionIntentClass): string {
  if (intentClass === 'monitoring_task_intent' || intentClass === 'watch_state_maintenance_intent') {
    return 'monitoring_request';
  }
  if (intentClass === 'review_request_intent') {
    return 'review_execution_request';
  }
  if (intentClass === 'stabilization_task_intent' || intentClass === 'blocking_cluster_followup_intent') {
    return 'stabilization_request';
  }
  return 'task_execution_request';
}

export function mapMissionControlOrchestrationActionItemToExecution(input: {
  actionItem: MissionControlOrchestrationActionItem;
}): MissionOrchestrationExecutionMapping | null {
  const executionIntentClass = SEED_ACTION_TO_INTENT[input.actionItem.actionClass];
  if (!executionIntentClass) {
    return null;
  }

  const requestGenerationRule = requestGenerationRuleForIntent(executionIntentClass);
  const reasonTokens = uniqueSortedStrings([
    ...input.actionItem.reasonTokens,
    `mapped_action_class:${input.actionItem.actionClass}`,
    `mapped_intent_class:${executionIntentClass}`,
    `request_generation_rule:${requestGenerationRule}`,
  ]);

  return {
    missionOrchestrationExecutionMappingId: deriveMissionOrchestrationExecutionMappingId({
      missionControlOrchestrationActionItemId: input.actionItem.missionControlOrchestrationActionItemId,
      executionIntentClass,
      requestGenerationRule,
      reasonTokens,
    }),
    missionControlOrchestrationActionItemId: input.actionItem.missionControlOrchestrationActionItemId,
    executionIntentClass,
    requestGenerationRule,
    reasonTokens,
    state: 'active',
  };
}

export function deriveMissionOrchestrationExecutionMappings(input: {
  actionItems: MissionControlOrchestrationActionItem[];
}): MissionOrchestrationExecutionMapping[] {
  return input.actionItems
    .map((actionItem) => mapMissionControlOrchestrationActionItemToExecution({ actionItem }))
    .filter((entry): entry is MissionOrchestrationExecutionMapping => entry !== null)
    .sort((left, right) => left.missionOrchestrationExecutionMappingId.localeCompare(right.missionOrchestrationExecutionMappingId));
}

export function listSeedMissionOrchestrationExecutionMappings() {
  return Object.entries(SEED_ACTION_TO_INTENT)
    .map(([actionClass, executionIntentClass]) => ({
      actionClass,
      executionIntentClass,
      requestGenerationRule: requestGenerationRuleForIntent(executionIntentClass),
    }))
    .sort((left, right) => left.actionClass.localeCompare(right.actionClass));
}
