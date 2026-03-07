import type { ExecutionEvent } from '../journal/types.ts';
import { WorkflowDag } from '../workflows/workflow-dag.ts';
import type { ValidatedWorkflowDefinition } from '../workflows/workflow-types.ts';
import type { RetryFailureCode, RetryPolicy } from './retry-policy.ts';
import { DEFAULT_RETRY_POLICY, evaluateRetryPolicy } from './retry-policy.ts';
import type { WorkflowNodeState, WorkflowRunState } from './failure-states.ts';

export type ReconstructedWorkflowState = {
  runId: string;
  workflowId: string;
  workflowState: WorkflowRunState;
  nodeStates: Record<string, WorkflowNodeState>;
  retryCountByNode: Record<string, number>;
  completedNodeIds: string[];
  failedNodeIds: string[];
  timedOutNodeIds: string[];
  cancelled: boolean;
  currentTick: number;
};

export type RecoveryPlan = {
  recoverable: boolean;
  reason: 'RECOVERABLE' | 'ALREADY_COMPLETED' | 'CANCELLED' | 'NO_FAILED_NODES';
  resumeNodeIds: string[];
  skippedCompletedNodeIds: string[];
  failedNodeIds: string[];
};

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function getFailureCode(payload: Record<string, unknown>): RetryFailureCode {
  const candidate = payload.failureCode;
  if (typeof candidate === 'string') {
    return candidate as RetryFailureCode;
  }

  const error = payload.error;
  if (typeof error === 'string' && error.includes('TIMEOUT')) {
    return 'NODE_TIMEOUT';
  }

  return 'ADAPTER_EXECUTION_FAILED';
}

function toRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

export function reconstructWorkflowStateFromJournal(input: {
  runId: string;
  workflowId: string;
  events: ExecutionEvent[];
}): ReconstructedWorkflowState {
  const ordered = [...input.events].sort((left, right) => left.sequence - right.sequence);
  const nodeStates: Record<string, WorkflowNodeState> = {};
  const retryCountByNode: Record<string, number> = {};
  let workflowState: WorkflowRunState = 'created';
  let cancelled = false;
  let currentTick = 0;

  for (const event of ordered) {
    currentTick = event.sequence;
    const nodeId = event.taskId ?? null;
    const payload = toRecord(event.payload);

    if (event.type === 'RUN_CREATED') {
      workflowState = 'running';
      continue;
    }

    if (event.type === 'WORKFLOW_RECOVERY_STARTED') {
      workflowState = 'recovering';
      continue;
    }

    if (event.type === 'WORKFLOW_RECOVERY_RESUMED') {
      workflowState = 'running';
      continue;
    }

    if (event.type === 'WORKFLOW_CANCELLED') {
      workflowState = 'cancelled';
      cancelled = true;
      continue;
    }

    if (event.type === 'WORKFLOW_TIMEOUT') {
      workflowState = 'timeout';
      continue;
    }

    if (event.type === 'RUN_COMPLETED') {
      workflowState = 'completed';
      continue;
    }

    if (event.type === 'RUN_FAILED') {
      workflowState = cancelled ? 'cancelled' : 'failed';
      continue;
    }

    if (!nodeId) {
      continue;
    }

    if (event.type === 'TASK_STARTED' || event.type === 'NODE_RETRY_STARTED') {
      nodeStates[nodeId] = 'running';
      workflowState = workflowState === 'created' ? 'running' : workflowState;
      continue;
    }

    if (event.type === 'TASK_COMPLETED') {
      nodeStates[nodeId] = 'completed';
      continue;
    }

    if (event.type === 'TASK_FAILED') {
      nodeStates[nodeId] = 'failed';
      continue;
    }

    if (event.type === 'NODE_TIMEOUT' || event.type === 'ADAPTER_TIMEOUT') {
      nodeStates[nodeId] = 'timeout';
      continue;
    }

    if (event.type === 'NODE_RETRY_SCHEDULED') {
      nodeStates[nodeId] = 'retrying';
      const retryAttempt = typeof payload.retryAttempt === 'number' ? payload.retryAttempt : 1;
      retryCountByNode[nodeId] = Math.max(retryCountByNode[nodeId] ?? 0, retryAttempt);
      continue;
    }

    if (event.type === 'NODE_RETRY_EXHAUSTED') {
      nodeStates[nodeId] = 'failed';
      continue;
    }
  }

  const completedNodeIds = sortedUnique(Object.keys(nodeStates).filter((nodeId) => nodeStates[nodeId] === 'completed'));
  const failedNodeIds = sortedUnique(Object.keys(nodeStates).filter((nodeId) => nodeStates[nodeId] === 'failed'));
  const timedOutNodeIds = sortedUnique(Object.keys(nodeStates).filter((nodeId) => nodeStates[nodeId] === 'timeout'));

  return {
    runId: input.runId,
    workflowId: input.workflowId,
    workflowState,
    nodeStates,
    retryCountByNode,
    completedNodeIds,
    failedNodeIds,
    timedOutNodeIds,
    cancelled,
    currentTick
  };
}

export function determineRecoveryPlan(input: {
  workflow: ValidatedWorkflowDefinition;
  state: ReconstructedWorkflowState;
}): RecoveryPlan {
  if (input.state.workflowState === 'completed') {
    return {
      recoverable: false,
      reason: 'ALREADY_COMPLETED',
      resumeNodeIds: [],
      skippedCompletedNodeIds: input.state.completedNodeIds,
      failedNodeIds: []
    };
  }

  if (input.state.cancelled || input.state.workflowState === 'cancelled') {
    return {
      recoverable: false,
      reason: 'CANCELLED',
      resumeNodeIds: [],
      skippedCompletedNodeIds: input.state.completedNodeIds,
      failedNodeIds: sortedUnique([...input.state.failedNodeIds, ...input.state.timedOutNodeIds])
    };
  }

  const failedNodeIds = sortedUnique([...input.state.failedNodeIds, ...input.state.timedOutNodeIds]);
  if (failedNodeIds.length === 0) {
    return {
      recoverable: false,
      reason: 'NO_FAILED_NODES',
      resumeNodeIds: [],
      skippedCompletedNodeIds: input.state.completedNodeIds,
      failedNodeIds: []
    };
  }

  const dag = new WorkflowDag(input.workflow);
  const runnable = dag.getRunnableNodeIds(input.state.completedNodeIds)
    .filter((nodeId) => failedNodeIds.includes(nodeId))
    .sort((left, right) => left.localeCompare(right));

  return {
    recoverable: true,
    reason: 'RECOVERABLE',
    resumeNodeIds: runnable,
    skippedCompletedNodeIds: input.state.completedNodeIds,
    failedNodeIds
  };
}

export function retryFailedNode(input: {
  state: ReconstructedWorkflowState;
  nodeId: string;
  policy?: RetryPolicy;
  failureCode?: RetryFailureCode;
}): {
  accepted: boolean;
  reason: string;
  retryAttempt?: number;
  tickDelay?: number;
  exhausted?: boolean;
} {
  const status = input.state.nodeStates[input.nodeId];
  if (status !== 'failed' && status !== 'timeout') {
    return { accepted: false, reason: 'NODE_NOT_FAILED' };
  }

  const policy = input.policy ?? DEFAULT_RETRY_POLICY;
  const failureCode = input.failureCode ?? 'ADAPTER_EXECUTION_FAILED';
  const previousRetryCount = input.state.retryCountByNode[input.nodeId] ?? 0;
  const evaluation = evaluateRetryPolicy({
    policy,
    failureCode,
    previousRetryCount
  });

  if (!evaluation.eligible) {
    return {
      accepted: false,
      reason: evaluation.reason,
      retryAttempt: evaluation.retryAttempt,
      exhausted: evaluation.exhausted
    };
  }

  return {
    accepted: true,
    reason: evaluation.reason,
    retryAttempt: evaluation.retryAttempt,
    tickDelay: evaluation.tickDelay,
    exhausted: evaluation.exhausted
  };
}

export function resumeWorkflowRun(input: {
  workflow: ValidatedWorkflowDefinition;
  state: ReconstructedWorkflowState;
}): {
  accepted: boolean;
  reason: string;
  plan: RecoveryPlan;
} {
  const plan = determineRecoveryPlan({ workflow: input.workflow, state: input.state });
  if (!plan.recoverable) {
    return {
      accepted: false,
      reason: plan.reason,
      plan
    };
  }

  return {
    accepted: true,
    reason: 'RECOVERY_READY',
    plan
  };
}

export function cancelWorkflowRun(input: {
  state: ReconstructedWorkflowState;
}): {
  accepted: boolean;
  reason: 'CANCELLED' | 'ALREADY_TERMINAL';
} {
  if (input.state.workflowState === 'completed' || input.state.workflowState === 'failed' || input.state.workflowState === 'cancelled') {
    return {
      accepted: false,
      reason: 'ALREADY_TERMINAL'
    };
  }

  return {
    accepted: true,
    reason: 'CANCELLED'
  };
}

export function deriveRetryEligibilityFromEvents(input: {
  runId: string;
  workflowId: string;
  nodeId: string;
  events: ExecutionEvent[];
  policy?: RetryPolicy;
}): {
  accepted: boolean;
  reason: string;
  retryAttempt?: number;
  tickDelay?: number;
  exhausted?: boolean;
} {
  const state = reconstructWorkflowStateFromJournal({
    runId: input.runId,
    workflowId: input.workflowId,
    events: input.events
  });

  const ordered = [...input.events].sort((left, right) => left.sequence - right.sequence);
  const latestFailure = [...ordered]
    .reverse()
    .find((event) => event.taskId === input.nodeId && (event.type === 'TASK_FAILED' || event.type === 'NODE_TIMEOUT' || event.type === 'ADAPTER_TIMEOUT'));

  const failureCode = latestFailure ? getFailureCode(toRecord(latestFailure.payload)) : 'ADAPTER_EXECUTION_FAILED';

  return retryFailedNode({
    state,
    nodeId: input.nodeId,
    policy: input.policy,
    failureCode
  });
}
