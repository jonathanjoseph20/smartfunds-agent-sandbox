import { describe, expect, it } from 'vitest';

import { deriveExecutionRequestActivationMappings } from '../../mission-control/execution-request-activation-mapping.ts';
import { createExecutionActivationRecord } from '../../mission-control/execution-activation-record.ts';
import type { ExecutionRequestRecord } from '../../mission-control/mission-execution-coordination-types.ts';

function request(requestClass: ExecutionRequestRecord['requestClass']): ExecutionRequestRecord {
  return {
    executionRequestRecordId: `${requestClass}-request`,
    missionExecutionCoordinationPlanId: 'plan-1',
    missionControlOrchestrationActionItemId: 'action-1',
    executionIntentId: 'intent-1',
    requestClass,
    targetExecutionDomain: 'mission_execution',
    priority: 'high',
    state: 'queued',
    reasonTokens: ['seed:1'],
  };
}

describe('mission execution activation mapping', () => {
  it('T-MEA-M1 maps requests to deterministic activation rules with explainable reasons', () => {
    const requests = [
      request('task_execution_request'),
      request('monitoring_request'),
      request('review_execution_request'),
      request('stabilization_request'),
    ];

    const activationRecords = requests.map((entry) => createExecutionActivationRecord({ request: entry }));

    const mappings = deriveExecutionRequestActivationMappings({
      requests,
      activationRecords,
    });

    expect(mappings).toHaveLength(4);
    expect(new Set(mappings.map((entry) => entry.activationRule))).toEqual(new Set([
      'monitoring_activation',
      'review_activation',
      'stabilization_followup_activation',
      'standard_task_activation',
    ]));
    expect(mappings.every((entry) => entry.reasonTokens.some((token) => token.startsWith('activation_rule:')))).toBe(true);
  });
});
