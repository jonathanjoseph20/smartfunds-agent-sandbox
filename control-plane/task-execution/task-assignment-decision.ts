import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { WorkerAssignmentDecision, WorkerSchedulingPolicy } from './task-orchestration-types.ts';

export const SINGLE_ASSIGNMENT_DEFAULT: WorkerSchedulingPolicy = {
  policyId: 'single-assignment-default',
  assignmentStrategy: 'single_assignment',
  workerSelectionStrategy: 'lexical',
  workerCapacityMode: 'strict',
  retryPriorityMode: 'after_fresh_ready',
  maxAssignmentsPerCycle: 1,
  enabled: true,
};

export const BALANCED_CAPACITY_DEFAULT: WorkerSchedulingPolicy = {
  policyId: 'balanced-capacity-default',
  assignmentStrategy: 'balanced_capacity',
  workerSelectionStrategy: 'balanced_capacity',
  workerCapacityMode: 'bounded_balanced',
  retryPriorityMode: 'after_fresh_ready',
  maxAssignmentsPerCycle: 4,
  enabled: true,
};

export const RETRY_PRIORITY_DEFAULT: WorkerSchedulingPolicy = {
  policyId: 'retry-priority-default',
  assignmentStrategy: 'retry_priority',
  workerSelectionStrategy: 'lexical',
  workerCapacityMode: 'strict',
  retryPriorityMode: 'before_fresh_ready',
  maxAssignmentsPerCycle: 4,
  enabled: true,
};

export const STABLE_LEXICAL_DEFAULT: WorkerSchedulingPolicy = {
  policyId: 'stable-lexical-default',
  assignmentStrategy: 'stable_lexical',
  workerSelectionStrategy: 'stable_lexical',
  workerCapacityMode: 'strict',
  retryPriorityMode: 'stable_mixed',
  maxAssignmentsPerCycle: 4,
  enabled: true,
};

const SEEDED_POLICIES: WorkerSchedulingPolicy[] = [
  SINGLE_ASSIGNMENT_DEFAULT,
  BALANCED_CAPACITY_DEFAULT,
  RETRY_PRIORITY_DEFAULT,
  STABLE_LEXICAL_DEFAULT,
].sort((left, right) => left.policyId.localeCompare(right.policyId));

export const DEFAULT_WORKER_SCHEDULING_POLICY_ID = STABLE_LEXICAL_DEFAULT.policyId;

function normalizeRecord(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(value)) as Record<string, unknown>;
}

export function listWorkerSchedulingPolicies(): WorkerSchedulingPolicy[] {
  return [...SEEDED_POLICIES].sort((left, right) => left.policyId.localeCompare(right.policyId));
}

export function getWorkerSchedulingPolicy(policyId: string): WorkerSchedulingPolicy {
  const found = SEEDED_POLICIES.find((policy) => policy.policyId === policyId);
  if (!found) {
    throw new Error(`TASK_WORKER_SCHEDULING_POLICY_NOT_FOUND: ${policyId}`);
  }

  if (!found.enabled) {
    throw new Error(`TASK_WORKER_SCHEDULING_POLICY_DISABLED: ${policyId}`);
  }

  return found;
}

export function deriveAssignmentDecisionId(input: {
  executionRunId: string;
  taskNodeId: string;
  cycleIndex: number;
  workerId: string | null;
  policyId: string;
  assignmentState: string;
  selectionReasonTokens: string[];
  deferralReasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    executionRunId: input.executionRunId,
    taskNodeId: input.taskNodeId,
    cycleIndex: input.cycleIndex,
    workerId: input.workerId,
    policyId: input.policyId,
    assignmentState: input.assignmentState,
    selectionReasonTokens: [...input.selectionReasonTokens].sort((left, right) => left.localeCompare(right)),
    deferralReasonTokens: [...input.deferralReasonTokens].sort((left, right) => left.localeCompare(right)),
  }));
}

export function normalizeAssignmentDecision(
  decision: WorkerAssignmentDecision,
): WorkerAssignmentDecision {
  return JSON.parse(canonicalStringify({
    ...decision,
    selectionReasonTokens: [...decision.selectionReasonTokens].sort((left, right) => left.localeCompare(right)),
    deferralReasonTokens: [...decision.deferralReasonTokens].sort((left, right) => left.localeCompare(right)),
    alternativesConsidered: [...decision.alternativesConsidered].sort((left, right) => left.localeCompare(right)),
    workerCompatibilitySummary: {
      compatibleWorkerIds: [...decision.workerCompatibilitySummary.compatibleWorkerIds].sort((left, right) => left.localeCompare(right)),
      incompatibleWorkerIds: [...decision.workerCompatibilitySummary.incompatibleWorkerIds].sort((left, right) => left.localeCompare(right)),
    },
    workerCapacitySummary: normalizeRecord(decision.workerCapacitySummary as unknown as Record<string, unknown>),
  })) as WorkerAssignmentDecision;
}
