import {
  deriveExecutionRequestRecordId,
  uniqueSortedStrings,
} from './mission-execution-coordination-identity.ts';
import type {
  ExecutionIntent,
  ExecutionRequestClass,
  ExecutionRequestRecord,
  ExecutionRequestState,
  MissionOrchestrationExecutionMapping,
} from './mission-execution-coordination-types.ts';
import type { MissionControlOrchestrationActionItem } from './mission-control-orchestration-types.ts';

function requestClassForRule(rule: string): ExecutionRequestClass {
  if (rule === 'monitoring_request') {
    return 'monitoring_request';
  }
  if (rule === 'review_execution_request') {
    return 'review_execution_request';
  }
  if (rule === 'stabilization_request') {
    return 'stabilization_request';
  }
  return 'task_execution_request';
}

function requestStateForIntentState(intentState: ExecutionIntent['state']): ExecutionRequestState {
  if (intentState === 'completed') {
    return 'completed';
  }
  if (intentState === 'active') {
    return 'active';
  }
  if (intentState === 'deferred') {
    return 'deferred';
  }
  if (intentState === 'failed') {
    return 'failed';
  }
  if (intentState === 'inconclusive') {
    return 'inconclusive';
  }
  if (intentState === 'queued') {
    return 'queued';
  }
  return 'created';
}

function requestTargetDomainForIntent(intentClass: ExecutionIntent['intentClass']): string {
  if (intentClass === 'monitoring_task_intent' || intentClass === 'watch_state_maintenance_intent') {
    return 'monitoring';
  }
  if (intentClass === 'review_request_intent') {
    return 'mission_control_review';
  }
  if (intentClass === 'stabilization_task_intent' || intentClass === 'blocking_cluster_followup_intent') {
    return 'mission_stabilization';
  }
  return 'mission_execution';
}

export function deriveExecutionRequestRecords(input: {
  missionExecutionCoordinationPlanId: string;
  intents: ExecutionIntent[];
  mappings: MissionOrchestrationExecutionMapping[];
  actionItems: MissionControlOrchestrationActionItem[];
  priority: string;
}): ExecutionRequestRecord[] {
  const mappingByActionId = new Map(input.mappings.map((entry) => [entry.missionControlOrchestrationActionItemId, entry]));
  const actionById = new Map(input.actionItems.map((entry) => [entry.missionControlOrchestrationActionItemId, entry]));

  const requests: ExecutionRequestRecord[] = [];

  for (const intent of input.intents) {
    for (const actionItemId of intent.linkedActionItemIds) {
      const mapping = mappingByActionId.get(actionItemId);
      if (!mapping) {
        continue;
      }

      const actionItem = actionById.get(actionItemId);
      const requestClass = requestClassForRule(mapping.requestGenerationRule);
      const targetExecutionDomain = requestTargetDomainForIntent(intent.intentClass);
      const reasonTokens = uniqueSortedStrings([
        ...intent.reasonTokens,
        ...mapping.reasonTokens,
        ...(actionItem?.reasonTokens ?? []),
        `request_class:${requestClass}`,
        `target_execution_domain:${targetExecutionDomain}`,
      ]);

      requests.push({
        executionRequestRecordId: deriveExecutionRequestRecordId({
          missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
          missionControlOrchestrationActionItemId: actionItemId,
          executionIntentId: intent.executionIntentId,
          requestClass,
          targetExecutionDomain,
          priority: input.priority,
          reasonTokens,
        }),
        missionExecutionCoordinationPlanId: input.missionExecutionCoordinationPlanId,
        missionControlOrchestrationActionItemId: actionItemId,
        executionIntentId: intent.executionIntentId,
        requestClass,
        targetExecutionDomain,
        priority: input.priority,
        state: requestStateForIntentState(intent.state),
        reasonTokens,
      });
    }
  }

  return requests.sort((left, right) => left.executionRequestRecordId.localeCompare(right.executionRequestRecordId));
}

export function sortExecutionRequestQueue(input: ExecutionRequestRecord[]): ExecutionRequestRecord[] {
  const stateRank: Record<ExecutionRequestState, number> = {
    active: 8,
    submitted: 7,
    queued: 6,
    created: 5,
    deferred: 4,
    inconclusive: 3,
    failed: 2,
    completed: 1,
  };

  const priorityRank = (priority: string): number => {
    if (priority === 'critical') {
      return 5;
    }
    if (priority === 'high') {
      return 4;
    }
    if (priority === 'normal') {
      return 3;
    }
    if (priority === 'low') {
      return 2;
    }
    return 1;
  };

  return [...input].sort((left, right) => {
    const byState = stateRank[right.state] - stateRank[left.state];
    if (byState !== 0) {
      return byState;
    }

    const byPriority = priorityRank(right.priority) - priorityRank(left.priority);
    if (byPriority !== 0) {
      return byPriority;
    }

    return left.executionRequestRecordId.localeCompare(right.executionRequestRecordId);
  });
}
