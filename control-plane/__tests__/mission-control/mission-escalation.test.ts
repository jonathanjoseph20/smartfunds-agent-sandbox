import { describe, expect, it } from 'vitest';

import { deriveMissionEscalations } from '../../mission-control/mission-escalation.ts';

describe('mission escalations', () => {
  it('T-MC-E1 detects retry exhaustion and terminal failure', () => {
    const escalations = deriveMissionEscalations({
      missionRunId: 'run-1',
      taskExecutionProjection: {
        nodeStates: { a: 'failed' },
        retryLimitBreaches: [{ taskNodeId: 'a', reason: 'max_retries_reached' }],
        retryAttempts: [],
        graphFailureState: 'retry_exhausted',
        blockingNodes: [],
        steps: [
          { executionStepId: 's1', stepType: 'node_retry_exhausted', taskNodeId: 'a' },
          { executionStepId: 's2', stepType: 'node_execution_failed', taskNodeId: 'a' },
        ],
        workerExecutionState: {},
        runningNodeCount: 0,
        readyNodeCount: 0,
      },
      taskOrchestrationProjection: {
        cycleState: 'completed',
        deferredNodes: [],
        assignments: [],
      },
      executionEngineProjection: {
        engineEligibilityState: 'eligible',
        blockingReasons: [],
      },
    });

    expect(escalations.map((entry) => entry.escalationClass)).toContain('retry_exhaustion');
    expect(escalations.map((entry) => entry.escalationClass)).toContain('terminal_node_failure');
  });

  it('T-MC-E2 detects deadlock and worker compatibility gap', () => {
    const escalations = deriveMissionEscalations({
      missionRunId: 'run-2',
      taskExecutionProjection: {
        nodeStates: { a: 'blocked' },
        retryLimitBreaches: [],
        retryAttempts: [],
        graphFailureState: 'none',
        blockingNodes: ['a'],
        steps: [],
        workerExecutionState: {},
        runningNodeCount: 0,
        readyNodeCount: 0,
      },
      taskOrchestrationProjection: {
        cycleState: 'blocked',
        deferredNodes: [{ taskNodeId: 'a', reasonTokens: ['no_compatible_worker'] }],
        assignments: [{
          assignmentDecisionId: 'ad1',
          taskNodeId: 'a',
          assignmentState: 'incompatible',
          deferralReasonTokens: ['no_compatible_worker'],
        }],
      },
      executionEngineProjection: {
        engineEligibilityState: 'eligible',
        blockingReasons: [],
      },
    });

    expect(escalations.map((entry) => entry.escalationClass)).toContain('orchestration_deadlock');
    expect(escalations.map((entry) => entry.escalationClass)).toContain('worker_compatibility_gap');
  });

  it('T-MC-E3 deduplicates escalation set under replay', () => {
    const input = {
      missionRunId: 'run-3',
      taskExecutionProjection: {
        nodeStates: { a: 'blocked' },
        retryLimitBreaches: [],
        retryAttempts: [{ taskNodeId: 'a', failureClass: 'POLICY_FAILURE', retryState: 'scheduled' }],
        graphFailureState: 'none',
        blockingNodes: ['a'],
        steps: [],
        workerExecutionState: {},
        runningNodeCount: 0,
        readyNodeCount: 0,
      },
      taskOrchestrationProjection: {
        cycleState: 'incomplete',
        deferredNodes: [{ taskNodeId: 'a', reasonTokens: ['no_capacity'] }],
        assignments: [{
          assignmentDecisionId: 'ad2',
          taskNodeId: 'a',
          assignmentState: 'capacity_exhausted',
          deferralReasonTokens: ['no_capacity'],
        }],
      },
      executionEngineProjection: {
        engineEligibilityState: 'blocked',
        blockingReasons: ['waiting_on_dependency'],
      },
    } as const;

    const first = deriveMissionEscalations(input);
    const second = deriveMissionEscalations(input);

    expect(second).toEqual(first);
    expect(new Set(first.map((entry) => entry.escalationId)).size).toBe(first.length);
  });
});
