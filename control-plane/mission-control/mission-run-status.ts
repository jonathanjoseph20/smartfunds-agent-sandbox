import type {
  MissionCompletionState,
  MissionHealthState,
  MissionOperationalState,
  MissionProgressSummary,
  MissionRunStatus,
} from './mission-run-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function deriveMissionOperationalState(input: {
  executionAttemptLifecycleState?: string;
  executionEngineState?: string;
  executionEngineEligibilityState?: string;
  progressSummary: MissionProgressSummary;
  completionState: MissionCompletionState;
  healthState: MissionHealthState;
  escalationCount: number;
}): { operationalState: MissionOperationalState; reasonTokens: string[] } {
  const reasons: string[] = [];

  if (!input.executionAttemptLifecycleState) {
    return {
      operationalState: 'pending',
      reasonTokens: ['execution_attempt_missing'],
    };
  }

  if (input.executionAttemptLifecycleState === 'cancelled' || input.executionEngineState === 'cancelled') {
    return {
      operationalState: 'cancelled',
      reasonTokens: ['execution_cancelled'],
    };
  }

  if (input.completionState === 'failed' || input.executionEngineState === 'failed') {
    return {
      operationalState: 'failed',
      reasonTokens: ['terminal_failure'],
    };
  }

  if (input.completionState === 'completed' || input.executionEngineState === 'completed') {
    return {
      operationalState: 'completed',
      reasonTokens: ['execution_completed'],
    };
  }

  if (input.progressSummary.retryingTaskCount > 0) {
    reasons.push(`retrying_node_count:${String(input.progressSummary.retryingTaskCount)}`);
    return {
      operationalState: 'retrying',
      reasonTokens: uniqueSorted(reasons),
    };
  }

  if (input.progressSummary.runningTaskCount > 0 || input.executionEngineState === 'running' || input.executionEngineState === 'started') {
    reasons.push(`running_node_count:${String(input.progressSummary.runningTaskCount)}`);
    return {
      operationalState: 'active',
      reasonTokens: uniqueSorted(reasons),
    };
  }

  if (
    input.completionState === 'blocked'
    || input.executionEngineEligibilityState === 'blocked'
    || input.progressSummary.blockedTaskCount > 0
    || input.progressSummary.remainingBlockingNodes.length > 0
  ) {
    reasons.push(`blocked_node_count:${String(input.progressSummary.blockedTaskCount)}`);
    return {
      operationalState: 'blocked',
      reasonTokens: uniqueSorted(reasons),
    };
  }

  if (input.healthState === 'degraded' || input.healthState === 'unstable' || input.escalationCount > 0) {
    reasons.push(`escalation_count:${String(input.escalationCount)}`);
    return {
      operationalState: 'degraded',
      reasonTokens: uniqueSorted(reasons),
    };
  }

  if (input.completionState === 'inconclusive' || input.healthState === 'inconclusive' || input.executionEngineEligibilityState === 'inconclusive') {
    return {
      operationalState: 'inconclusive',
      reasonTokens: ['inconclusive_runtime_signals'],
    };
  }

  return {
    operationalState: 'pending',
    reasonTokens: ['execution_not_started'],
  };
}

export function deriveMissionRunStatus(input: {
  missionRunId: string;
  missionId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  executionAttemptLifecycleState?: string;
  executionEngineState?: string;
  executionEngineEligibilityState?: string;
  progressSummary: MissionProgressSummary;
  completionState: MissionCompletionState;
  healthState: MissionHealthState;
  escalationCount: number;
}): MissionRunStatus {
  const operational = deriveMissionOperationalState({
    executionAttemptLifecycleState: input.executionAttemptLifecycleState,
    executionEngineState: input.executionEngineState,
    executionEngineEligibilityState: input.executionEngineEligibilityState,
    progressSummary: input.progressSummary,
    completionState: input.completionState,
    healthState: input.healthState,
    escalationCount: input.escalationCount,
  });

  return {
    missionRunId: input.missionRunId,
    missionId: input.missionId,
    executionAttemptId: input.executionAttemptId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    operationalState: operational.operationalState,
    completionState: input.completionState,
    healthState: input.healthState,
    reasonTokens: operational.reasonTokens,
  };
}
