import {
  deriveExecutionRequestActivationMappingId,
  uniqueSortedStrings,
} from './mission-execution-activation-identity.ts';
import type {
  ExecutionActivationRule,
  ExecutionRequestActivationMapping,
} from './mission-execution-activation-types.ts';
import type { ExecutionActivationRecord } from './mission-execution-activation-types.ts';
import type { ExecutionRequestRecord } from './mission-execution-coordination-types.ts';

function activationRuleForRequest(request: ExecutionRequestRecord): ExecutionActivationRule {
  if (request.requestClass === 'monitoring_request') {
    return 'monitoring_activation';
  }
  if (request.requestClass === 'review_execution_request') {
    return 'review_activation';
  }
  if (request.requestClass === 'stabilization_request') {
    return 'stabilization_followup_activation';
  }
  return 'standard_task_activation';
}

export function deriveExecutionRequestActivationMappings(input: {
  requests: ExecutionRequestRecord[];
  activationRecords: ExecutionActivationRecord[];
}): ExecutionRequestActivationMapping[] {
  const activationByRequestId = new Map(
    input.activationRecords.map((entry) => [entry.executionRequestRecordId, entry])
  );

  return input.requests
    .map((request) => {
      const activation = activationByRequestId.get(request.executionRequestRecordId);
      if (!activation) {
        return null;
      }

      const activationRule = activationRuleForRequest(request);
      const reasonTokens = uniqueSortedStrings([
        ...request.reasonTokens,
        `activation_rule:${activationRule}`,
      ]);

      return {
        executionRequestActivationMappingId: deriveExecutionRequestActivationMappingId({
          executionRequestRecordId: request.executionRequestRecordId,
          executionActivationRecordId: activation.executionActivationRecordId,
          activationRule,
          reasonTokens,
        }),
        executionRequestRecordId: request.executionRequestRecordId,
        executionActivationRecordId: activation.executionActivationRecordId,
        activationRule,
        reasonTokens,
        state: 'active',
      } satisfies ExecutionRequestActivationMapping;
    })
    .filter((entry): entry is ExecutionRequestActivationMapping => entry !== null)
    .sort((left, right) => left.executionRequestActivationMappingId.localeCompare(right.executionRequestActivationMappingId));
}
