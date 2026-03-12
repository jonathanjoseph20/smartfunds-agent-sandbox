import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { MissionEscalation } from './mission-run-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function deriveEscalationId(input: {
  missionRunId: string;
  escalationClass: MissionEscalation['escalationClass'];
  linkedTaskNodeIds: string[];
  linkedExecutionEventIds: string[];
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    missionRunId: input.missionRunId,
    escalationClass: input.escalationClass,
    linkedTaskNodeIds: [...input.linkedTaskNodeIds].sort((left, right) => left.localeCompare(right)),
    linkedExecutionEventIds: [...input.linkedExecutionEventIds].sort((left, right) => left.localeCompare(right)),
    reasonTokens: [...input.reasonTokens].sort((left, right) => left.localeCompare(right)),
  }));
}

function toEscalation(input: {
  missionRunId: string;
  escalationClass: MissionEscalation['escalationClass'];
  severity: MissionEscalation['severity'];
  linkedTaskNodeIds?: string[];
  linkedExecutionEventIds?: string[];
  reasonTokens?: string[];
}): MissionEscalation {
  const linkedTaskNodeIds = uniqueSorted(input.linkedTaskNodeIds ?? []);
  const linkedExecutionEventIds = uniqueSorted(input.linkedExecutionEventIds ?? []);
  const reasonTokens = uniqueSorted(input.reasonTokens ?? []);

  return {
    missionRunId: input.missionRunId,
    escalationId: deriveEscalationId({
      missionRunId: input.missionRunId,
      escalationClass: input.escalationClass,
      linkedTaskNodeIds,
      linkedExecutionEventIds,
      reasonTokens,
    }),
    escalationClass: input.escalationClass,
    severity: input.severity,
    linkedTaskNodeIds,
    linkedExecutionEventIds,
    reasonTokens,
    state: 'open',
  };
}

export function deriveMissionEscalations(input: {
  missionRunId: string;
  taskExecutionProjection?: {
    nodeStates: Record<string, string>;
    retryLimitBreaches: Array<{ taskNodeId: string; reason: string }>;
    retryAttempts: Array<{ taskNodeId: string; failureClass: string; retryState: string }>;
    graphFailureState: string;
    blockingNodes: string[];
    steps: Array<{ executionStepId: string; stepType: string; taskNodeId: string | null }>;
    workerExecutionState: Record<string, { taskNodeId: string; failureClass?: string }>;
    runningNodeCount: number;
    readyNodeCount: number;
  } | null;
  taskOrchestrationProjection?: {
    cycleState: string;
    deferredNodes: Array<{ taskNodeId: string; reasonTokens: string[] }>;
    assignments: Array<{
      assignmentDecisionId: string;
      taskNodeId: string;
      assignmentState: string;
      deferralReasonTokens: string[];
    }>;
  } | null;
  executionEngineProjection?: {
    engineEligibilityState: string;
    blockingReasons: string[];
  } | null;
}): MissionEscalation[] {
  const escalations: MissionEscalation[] = [];

  const retryLimitBreaches = input.taskExecutionProjection?.retryLimitBreaches ?? [];
  if (retryLimitBreaches.length > 0 || input.taskExecutionProjection?.graphFailureState === 'retry_exhausted') {
    escalations.push(toEscalation({
      missionRunId: input.missionRunId,
      escalationClass: 'retry_exhaustion',
      severity: 'high',
      linkedTaskNodeIds: retryLimitBreaches.map((entry) => entry.taskNodeId),
      reasonTokens: [
        ...retryLimitBreaches.map((entry) => `retry_limit_breach:${entry.reason}`),
        ...(input.taskExecutionProjection?.graphFailureState === 'retry_exhausted' ? ['graph_failure_state:retry_exhausted'] : []),
      ],
      linkedExecutionEventIds: (input.taskExecutionProjection?.steps ?? [])
        .filter((step) => step.stepType === 'node_retry_exhausted')
        .map((step) => step.executionStepId),
    }));
  }

  const failedNodeIds = Object.entries(input.taskExecutionProjection?.nodeStates ?? {})
    .filter(([, state]) => state === 'failed' || state === 'permanently_failed')
    .map(([taskNodeId]) => taskNodeId);

  if (failedNodeIds.length > 0 || input.taskExecutionProjection?.graphFailureState === 'unrecoverable_failure') {
    escalations.push(toEscalation({
      missionRunId: input.missionRunId,
      escalationClass: 'terminal_node_failure',
      severity: 'critical',
      linkedTaskNodeIds: failedNodeIds,
      reasonTokens: [
        ...(failedNodeIds.length > 0 ? [`failed_node_count:${String(failedNodeIds.length)}`] : []),
        ...(input.taskExecutionProjection?.graphFailureState === 'unrecoverable_failure' ? ['graph_failure_state:unrecoverable_failure'] : []),
      ],
      linkedExecutionEventIds: (input.taskExecutionProjection?.steps ?? [])
        .filter((step) => step.stepType === 'node_execution_failed')
        .map((step) => step.executionStepId),
    }));
  }

  const capacityDeferred = [
    ...(input.taskOrchestrationProjection?.deferredNodes ?? [])
      .filter((entry) => entry.reasonTokens.includes('no_capacity'))
      .map((entry) => entry.taskNodeId),
    ...(input.taskOrchestrationProjection?.assignments ?? [])
      .filter((entry) => entry.assignmentState === 'capacity_exhausted' || entry.deferralReasonTokens.includes('no_capacity'))
      .map((entry) => entry.taskNodeId),
  ];

  if (capacityDeferred.length > 0) {
    escalations.push(toEscalation({
      missionRunId: input.missionRunId,
      escalationClass: 'worker_capacity_exhausted',
      severity: 'high',
      linkedTaskNodeIds: capacityDeferred,
      linkedExecutionEventIds: (input.taskOrchestrationProjection?.assignments ?? [])
        .filter((entry) => entry.assignmentState === 'capacity_exhausted' || entry.deferralReasonTokens.includes('no_capacity'))
        .map((entry) => entry.assignmentDecisionId),
      reasonTokens: ['worker_capacity_exhausted'],
    }));
  }

  const incompatibleDeferred = [
    ...(input.taskOrchestrationProjection?.deferredNodes ?? [])
      .filter((entry) => entry.reasonTokens.includes('no_compatible_worker'))
      .map((entry) => entry.taskNodeId),
    ...(input.taskOrchestrationProjection?.assignments ?? [])
      .filter((entry) => entry.assignmentState === 'incompatible' || entry.deferralReasonTokens.includes('no_compatible_worker'))
      .map((entry) => entry.taskNodeId),
  ];

  if (incompatibleDeferred.length > 0) {
    escalations.push(toEscalation({
      missionRunId: input.missionRunId,
      escalationClass: 'worker_compatibility_gap',
      severity: 'high',
      linkedTaskNodeIds: incompatibleDeferred,
      linkedExecutionEventIds: (input.taskOrchestrationProjection?.assignments ?? [])
        .filter((entry) => entry.assignmentState === 'incompatible' || entry.deferralReasonTokens.includes('no_compatible_worker'))
        .map((entry) => entry.assignmentDecisionId),
      reasonTokens: ['worker_compatibility_gap'],
    }));
  }

  const policyFailureNodes = [
    ...(input.taskExecutionProjection?.retryAttempts ?? [])
      .filter((entry) => entry.failureClass === 'POLICY_FAILURE')
      .map((entry) => entry.taskNodeId),
    ...Object.values(input.taskExecutionProjection?.workerExecutionState ?? {})
      .filter((entry) => entry.failureClass === 'POLICY_FAILURE')
      .map((entry) => entry.taskNodeId),
  ];

  if (policyFailureNodes.length > 0) {
    escalations.push(toEscalation({
      missionRunId: input.missionRunId,
      escalationClass: 'policy_failure',
      severity: 'critical',
      linkedTaskNodeIds: policyFailureNodes,
      reasonTokens: ['policy_failure_detected'],
    }));
  }

  const blockedNodes = input.taskExecutionProjection?.blockingNodes ?? [];
  if (blockedNodes.length > 0) {
    escalations.push(toEscalation({
      missionRunId: input.missionRunId,
      escalationClass: 'unresolved_blocking_chain',
      severity: 'medium',
      linkedTaskNodeIds: blockedNodes,
      reasonTokens: ['blocking_chain_unresolved'],
    }));
  }

  const orchestrationDeadlocked = Boolean(
    input.taskOrchestrationProjection
      && (input.taskOrchestrationProjection.cycleState === 'blocked' || input.taskOrchestrationProjection.cycleState === 'incomplete')
      && (input.taskExecutionProjection?.runningNodeCount ?? 0) === 0
      && (input.taskExecutionProjection?.readyNodeCount ?? 0) === 0
      && (input.taskOrchestrationProjection.deferredNodes.length > 0),
  );

  if (orchestrationDeadlocked) {
    escalations.push(toEscalation({
      missionRunId: input.missionRunId,
      escalationClass: 'orchestration_deadlock',
      severity: 'critical',
      linkedTaskNodeIds: input.taskOrchestrationProjection?.deferredNodes.map((entry) => entry.taskNodeId) ?? [],
      reasonTokens: ['orchestration_cycle_deadlock'],
    }));
  }

  if ((input.executionEngineProjection?.engineEligibilityState ?? '') === 'blocked') {
    escalations.push(toEscalation({
      missionRunId: input.missionRunId,
      escalationClass: 'unresolved_blocking_chain',
      severity: 'high',
      reasonTokens: input.executionEngineProjection?.blockingReasons ?? ['engine_blocked'],
    }));
  }

  return Array.from(new Map(escalations.map((entry) => [entry.escalationId, entry])).values())
    .sort((left, right) => left.escalationId.localeCompare(right.escalationId));
}
