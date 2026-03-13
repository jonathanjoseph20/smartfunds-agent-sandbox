import { describe, expect, it } from 'vitest';

import { deriveExecutionActivationEligibility } from '../../mission-control/execution-activation-eligibility.ts';
import type {
  ExecutionRequestRecord,
  MissionExecutionCoordinationProjection,
} from '../../mission-control/mission-execution-coordination-types.ts';

function request(state: ExecutionRequestRecord['state'], domain = 'mission_execution'): ExecutionRequestRecord {
  return {
    executionRequestRecordId: 'request-1',
    missionExecutionCoordinationPlanId: 'plan-1',
    missionControlOrchestrationActionItemId: 'action-1',
    executionIntentId: 'intent-1',
    requestClass: 'task_execution_request',
    targetExecutionDomain: domain,
    priority: 'high',
    state,
    reasonTokens: [],
  };
}

function projection(status: MissionExecutionCoordinationProjection['status']['status']): MissionExecutionCoordinationProjection {
  return {
    missionExecutionCoordinationPlanId: 'plan-1',
    missionControlInterventionPlanId: 'intervention-1',
    executionIntentSummaries: [],
    executionRequestSummaries: [],
    feedbackLinkSummaries: [],
    status: { missionExecutionCoordinationPlanId: 'plan-1', status, reasonTokens: [] },
    outcome: { missionExecutionCoordinationPlanId: 'plan-1', outcome: 'pending', reasonTokens: [] },
    priority: 'high',
    linkedActionItemIds: [],
    linkedExecutionAttemptIds: [],
    coordinationHistory: { missionExecutionCoordinationPlanId: 'plan-1', entries: [] },
    plan: {
      missionExecutionCoordinationPlanId: 'plan-1',
      missionControlInterventionPlanId: 'intervention-1',
      displayName: 'Plan',
      strategyClass: 'strategy',
      executionIntentIds: [],
      executionRequestIds: [],
      priority: 'high',
      state: 'queued',
      outcome: 'pending',
    },
    statusPreview: {},
    reportPreview: {},
  };
}

describe('mission execution activation eligibility', () => {
  it('T-MEA-E1 derives eligible status', () => {
    const result = deriveExecutionActivationEligibility({
      request: request('submitted'),
      missionExecutionCoordinationProjection: projection('execution_active'),
      runtimeCapabilities: [{ targetExecutionDomain: 'mission_execution', capabilityStatus: 'enabled' }],
    });

    expect(result.eligibilityStatus).toBe('eligible');
  });

  it('T-MEA-E2 derives blocked status when runtime capability is disabled', () => {
    const result = deriveExecutionActivationEligibility({
      request: request('submitted'),
      missionExecutionCoordinationProjection: projection('execution_active'),
      runtimeCapabilities: [{ targetExecutionDomain: 'mission_execution', capabilityStatus: 'disabled' }],
    });

    expect(result.eligibilityStatus).toBe('blocked_from_activation');
    expect(result.blockingConditionTokens).toContain('runtime_capability_disabled:mission_execution');
  });

  it('T-MEA-E3 derives conditionally eligible for queued request', () => {
    const result = deriveExecutionActivationEligibility({
      request: request('queued'),
      missionExecutionCoordinationProjection: projection('pending_execution'),
      runtimeCapabilities: [{ targetExecutionDomain: 'mission_execution', capabilityStatus: 'enabled' }],
    });

    expect(result.eligibilityStatus).toBe('conditionally_eligible');
  });
});
