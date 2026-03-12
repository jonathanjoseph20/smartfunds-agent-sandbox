export const TASK_EXECUTION_GRAPH_STATES = [
  'running',
  'blocked',
  'completed',
  'failed',
] as const;

export const TASK_EXECUTION_NODE_STATES = [
  'pending',
  'ready',
  'running',
  'completed',
  'failed',
  'retrying',
  'permanently_failed',
  'blocked',
  'skipped',
] as const;

export const TASK_EXECUTION_STEP_TYPES = [
  'node_execution_started',
  'node_execution_completed',
  'node_execution_failed',
  'node_retry_scheduled',
  'node_retry_started',
  'node_retry_exhausted',
  'node_blocked',
  'graph_execution_progressed',
  'graph_execution_completed',
] as const;

export const TASK_EXECUTION_STEP_STATES = [
  'accepted',
  'deduped',
] as const;

export const TASK_EXECUTION_ERROR_CODES = [
  'TASK_GRAPH_NOT_FOUND',
  'TASK_EXECUTION_RUN_NOT_FOUND',
  'INVALID_TASK_NODE_TRANSITION',
  'TASK_NODE_NOT_READY',
  'TASK_GRAPH_BLOCKED',
  'TASK_EXECUTION_ALREADY_COMPLETED',
  'TASK_EXECUTION_STEP_INVALID',
  'TASK_EXECUTION_HISTORY_CONFLICT',
] as const;

export type TaskExecutionGraphState = typeof TASK_EXECUTION_GRAPH_STATES[number];
export type TaskExecutionNodeState = typeof TASK_EXECUTION_NODE_STATES[number];
export type TaskExecutionStepType = typeof TASK_EXECUTION_STEP_TYPES[number];
export type TaskExecutionStepState = typeof TASK_EXECUTION_STEP_STATES[number];
export type TaskExecutionErrorCode = typeof TASK_EXECUTION_ERROR_CODES[number];

export interface MissionTaskExecutionStep {
  executionStepId: string;
  executionEngineRunId: string;
  executionAttemptId: string;
  taskGraphId: string;
  taskNodeId: string | null;
  stepIndex: number;
  stepType: TaskExecutionStepType;
  stepState: TaskExecutionStepState;
  stepInputs: Record<string, unknown>;
  stepOutputs: Record<string, unknown>;
  eventDedupeKey: string;
}

export interface MissionTaskExecutionEngine {
  executionEngineRunId: string;
  executionAttemptId: string;
  taskGraphId: string;
  engineState: 'active' | 'completed' | 'blocked' | 'failed';
  executionStepCount: number;
  lastExecutionStepId: string | null;
  readyNodeCount: number;
  runningNodeCount: number;
  completedNodeCount: number;
  blockedNodeCount: number;
  graphState: TaskExecutionGraphState;
  executionProgress: {
    completed: number;
    total: number;
    ratio: number;
  };
  blockingReasons: string[];
  provenanceInputs: {
    taskGraphState: string;
    taskGraphNodeCount: number;
    taskGraphEdgeCount: number;
    taskGraphBlockingReasons: string[];
  };
}

export interface MissionTaskExecutionHistoryEntry {
  executionEngineRunId: string;
  executionAttemptId: string;
  taskGraphId: string;
  eventIndex: number;
  eventType: TaskExecutionStepType;
  eventPayload: Record<string, unknown>;
  eventDedupeKey: string;
}

export interface MissionTaskExecutionHistory {
  executionEngineRunId: string;
  executionAttemptId: string;
  taskGraphId: string;
  entries: MissionTaskExecutionHistoryEntry[];
}

export interface MissionTaskExecutionProjection {
  executionEngineRunId: string;
  executionAttemptId: string;
  taskGraphId: string;
  executionStepCount: number;
  failedNodeCount: number;
  retryingNodeCount: number;
  readyNodeCount: number;
  runningNodeCount: number;
  completedNodeCount: number;
  blockedNodeCount: number;
  graphState: TaskExecutionGraphState;
  executionProgress: {
    completed: number;
    total: number;
    ratio: number;
  };
  blockingReasons: string[];
  blockingNodes: string[];
  lastExecutionStepId: string | null;
  engineState: 'active' | 'completed' | 'blocked' | 'failed';
  steps: MissionTaskExecutionStep[];
  nodeStates: Record<string, TaskExecutionNodeState>;
  retryAttempts: Array<{
    taskNodeId: string;
    attemptIndex: number;
    failureClass: string;
    retryPolicyId: string;
    retryState: string;
    retryCount: number;
  }>;
  retryLimitBreaches: Array<{
    taskNodeId: string;
    retryPolicyId: string;
    attemptIndex: number;
    reason: string;
  }>;
  graphFailureState: 'none' | 'retry_exhausted' | 'unrecoverable_failure';
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
    historyJsonPath: string;
    stepsJsonPath: string;
    progressJsonPath: string;
    failuresJsonPath: string;
    retriesJsonPath: string;
    blockersJsonPath: string;
  };
  provenanceInputs: MissionTaskExecutionEngine['provenanceInputs'];
}

export interface MissionTaskExecutionMaterializationSummary {
  executionEngineRunId: string;
  executionAttemptId: string;
  taskGraphId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  stepsPath: string;
  progressPath: string;
  failuresPath: string;
  retriesPath: string;
  blockersPath: string;
}
