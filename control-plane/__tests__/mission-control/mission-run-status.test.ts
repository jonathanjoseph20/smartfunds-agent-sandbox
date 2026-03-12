import { describe, expect, it } from 'vitest';

import { deriveMissionRunStatus } from '../../mission-control/mission-run-status.ts';
import type { MissionProgressSummary } from '../../mission-control/mission-run-types.ts';

function progress(overrides: Partial<MissionProgressSummary>): MissionProgressSummary {
  return {
    totalTaskCount: 3,
    pendingTaskCount: 0,
    readyTaskCount: 0,
    runningTaskCount: 0,
    retryingTaskCount: 0,
    completedTaskCount: 0,
    failedTaskCount: 0,
    blockedTaskCount: 0,
    skippedTaskCount: 0,
    completionPercent: 0,
    criticalPathState: 'constrained',
    remainingBlockingNodes: [],
    ...overrides,
  };
}

describe('mission run status', () => {
  it('T-MC-S1 derives pending to active transition', () => {
    const pending = deriveMissionRunStatus({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      progressSummary: progress({ pendingTaskCount: 3 }),
      completionState: 'not_started',
      healthState: 'unstable',
      escalationCount: 0,
    });

    const active = deriveMissionRunStatus({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      executionAttemptLifecycleState: 'prepared',
      executionEngineState: 'running',
      progressSummary: progress({ runningTaskCount: 1, pendingTaskCount: 2 }),
      completionState: 'in_progress',
      healthState: 'unstable',
      escalationCount: 0,
    });

    expect(pending.operationalState).toBe('pending');
    expect(active.operationalState).toBe('active');
  });

  it('T-MC-S2 derives active to retrying transition', () => {
    const status = deriveMissionRunStatus({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      executionAttemptLifecycleState: 'prepared',
      executionEngineState: 'running',
      progressSummary: progress({ retryingTaskCount: 1, runningTaskCount: 0, pendingTaskCount: 2 }),
      completionState: 'in_progress',
      healthState: 'degraded',
      escalationCount: 1,
    });

    expect(status.operationalState).toBe('retrying');
  });

  it('T-MC-S3 derives active to blocked transition', () => {
    const status = deriveMissionRunStatus({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      executionAttemptLifecycleState: 'prepared',
      executionEngineEligibilityState: 'blocked',
      progressSummary: progress({ blockedTaskCount: 1, remainingBlockingNodes: ['node-a'] }),
      completionState: 'blocked',
      healthState: 'blocked',
      escalationCount: 1,
    });

    expect(status.operationalState).toBe('blocked');
  });

  it('T-MC-S4 derives active to degraded transition', () => {
    const status = deriveMissionRunStatus({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      executionAttemptLifecycleState: 'prepared',
      progressSummary: progress({ pendingTaskCount: 2, runningTaskCount: 0 }),
      completionState: 'in_progress',
      healthState: 'degraded',
      escalationCount: 2,
    });

    expect(status.operationalState).toBe('degraded');
  });

  it('T-MC-S5 derives active to completed transition', () => {
    const status = deriveMissionRunStatus({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      executionAttemptLifecycleState: 'prepared',
      executionEngineState: 'completed',
      progressSummary: progress({ completedTaskCount: 3, completionPercent: 100 }),
      completionState: 'completed',
      healthState: 'healthy',
      escalationCount: 0,
    });

    expect(status.operationalState).toBe('completed');
  });

  it('T-MC-S6 derives active to failed transition', () => {
    const status = deriveMissionRunStatus({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      executionAttemptLifecycleState: 'prepared',
      executionEngineState: 'failed',
      progressSummary: progress({ failedTaskCount: 1 }),
      completionState: 'failed',
      healthState: 'failed',
      escalationCount: 1,
    });

    expect(status.operationalState).toBe('failed');
  });
});
