import { describe, expect, it } from 'vitest';

import { createExecutionActivationRecord } from '../../mission-control/execution-activation-record.ts';
import { deriveMissionExecutionActivationQueueEntry, sortMissionExecutionActivationQueue } from '../../mission-control/mission-execution-activation-queue.ts';
import type { ExecutionActivationEligibility } from '../../mission-control/mission-execution-activation-types.ts';
import type { ExecutionRequestRecord } from '../../mission-control/mission-execution-coordination-types.ts';

function request(id: string, priority: string): ExecutionRequestRecord {
  return {
    executionRequestRecordId: id,
    missionExecutionCoordinationPlanId: 'plan-1',
    missionControlOrchestrationActionItemId: 'action-1',
    executionIntentId: 'intent-1',
    requestClass: 'task_execution_request',
    targetExecutionDomain: 'mission_execution',
    priority,
    state: 'queued',
    reasonTokens: [],
  };
}

function eligibility(requestId: string, status: ExecutionActivationEligibility['eligibilityStatus']): ExecutionActivationEligibility {
  return {
    executionActivationEligibilityId: `${requestId}-${status}`,
    executionRequestRecordId: requestId,
    eligibilityStatus: status,
    reasonTokens: [],
    blockingConditionTokens: [],
    state: 'active',
  };
}

describe('mission execution activation queue', () => {
  it('T-MEA-Q1 queue ordering is deterministic by priority then activationRecordId', () => {
    const lowRecord = createExecutionActivationRecord({ request: request('request-low', 'low') });
    const highRecord = createExecutionActivationRecord({ request: request('request-high', 'high') });

    const lowQueue = deriveMissionExecutionActivationQueueEntry({
      activationRecord: lowRecord,
      eligibility: eligibility('request-low', 'eligible'),
      feedbackLinks: [],
      historyEntries: [],
    });

    const highQueue = deriveMissionExecutionActivationQueueEntry({
      activationRecord: highRecord,
      eligibility: eligibility('request-high', 'eligible'),
      feedbackLinks: [],
      historyEntries: [],
    });

    const sorted = sortMissionExecutionActivationQueue([lowQueue, highQueue]);
    expect(sorted[0]!.executionActivationRecordId).toBe(highRecord.executionActivationRecordId);
  });

  it('T-MEA-Q2 blocked eligibility maps to blocked queue state', () => {
    const record = createExecutionActivationRecord({ request: request('request-1', 'high') });

    const queue = deriveMissionExecutionActivationQueueEntry({
      activationRecord: record,
      eligibility: eligibility('request-1', 'blocked_from_activation'),
      feedbackLinks: [],
      historyEntries: [],
    });

    expect(queue.queueState).toBe('blocked');
  });
});
