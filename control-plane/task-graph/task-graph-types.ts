export const TASK_GRAPH_STATES = [
  'initialized',
  'evaluated',
  'ready_for_execution',
  'running',
  'completed',
  'blocked',
  'archived',
] as const;

export const TASK_GRAPH_ELIGIBILITY_STATES = [
  'eligible',
  'waiting_on_dependencies',
  'blocked',
] as const;

export const TASK_NODE_STATES = [
  'pending',
  'ready',
  'running',
  'completed',
  'failed',
  'blocked',
  'skipped',
] as const;

export const TASK_NODE_ELIGIBILITY_STATES = [
  'eligible',
  'waiting_on_dependencies',
  'blocked',
] as const;

export const TASK_EDGE_DEPENDENCY_TYPES = [
  'finish_to_start',
  'start_to_start',
  'finish_to_finish',
] as const;

export const TASK_EDGE_STATES = [
  'active',
  'satisfied',
  'blocked',
] as const;

export const TASK_GRAPH_HISTORY_EVENT_TYPES = [
  'graph_initialized',
  'graph_evaluated',
  'node_ready',
  'node_started',
  'node_completed',
  'node_failed',
  'graph_completed',
  'graph_blocked',
  'graph_materialized',
] as const;

export type TaskGraphState = typeof TASK_GRAPH_STATES[number];
export type TaskGraphEligibilityState = typeof TASK_GRAPH_ELIGIBILITY_STATES[number];
export type TaskNodeState = typeof TASK_NODE_STATES[number];
export type TaskNodeEligibilityState = typeof TASK_NODE_ELIGIBILITY_STATES[number];
export type TaskEdgeDependencyType = typeof TASK_EDGE_DEPENDENCY_TYPES[number];
export type TaskEdgeState = typeof TASK_EDGE_STATES[number];
export type TaskGraphHistoryEventType = typeof TASK_GRAPH_HISTORY_EVENT_TYPES[number];

export interface MissionTaskNode {
  taskNodeId: string;
  taskGraphId: string;
  taskType: string;
  taskName: string;
  taskDescription: string;
  taskInputs: Record<string, unknown>;
  taskOutputs: Record<string, unknown>;
  requiredCapabilities: string[];
  retryPolicy?: {
    retryPolicyId: string;
    maxRetries: number;
    retryStrategy: 'immediate';
    retryDelayModel: 'immediate' | 'deterministic_linear' | 'deterministic_exponential';
    retryConditions: string[];
    baseDelay: number;
  };
  taskState: TaskNodeState;
  taskEligibilityState: TaskNodeEligibilityState;
  blockingReasons: string[];
  limitations: string[];
  provenanceInputs: Record<string, unknown>;
}

export interface MissionTaskEdge {
  taskEdgeId: string;
  taskGraphId: string;
  sourceNodeId: string;
  targetNodeId: string;
  dependencyType: TaskEdgeDependencyType;
  edgeState: TaskEdgeState;
}

export interface MissionTaskGraph {
  taskGraphId: string;
  executionEngineRunId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  taskNodes: MissionTaskNode[];
  taskEdges: MissionTaskEdge[];
  graphState: TaskGraphState;
  graphEligibilityState: TaskGraphEligibilityState;
  nodeCount: number;
  edgeCount: number;
  blockingReasons: string[];
  limitations: string[];
  provenanceInputs: {
    engineState: string;
    engineEligibilityState: string;
    engineBlockingReasons: string[];
    engineLimitations: string[];
    runtimeEnvelopeState: string;
    runtimeEnvelopeEligibility: string;
    runtimeEnvelopeLimitations: string[];
    runtimeEnvelopeBlockers: string[];
  };
}

export interface MissionTaskGraphHistoryEntry {
  taskGraphId: string;
  executionEngineRunId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  eventIndex: number;
  eventType: TaskGraphHistoryEventType;
  eventDedupeKey: string;
  reasoning: string;
  eventPayload: Record<string, unknown>;
}

export interface MissionTaskGraphHistory {
  taskGraphId: string;
  executionEngineRunId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  entries: MissionTaskGraphHistoryEntry[];
}

export interface MissionTaskGraphProjection extends MissionTaskGraph {
  historySummary: {
    totalEvents: number;
    lastEventType?: TaskGraphHistoryEventType;
    lastEventDedupeKey?: string;
  };
  nodeStateCounts: Record<string, number>;
  readyNodeCount: number;
  runningNodeCount: number;
  completedNodeCount: number;
  blockedNodeCount: number;
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
    historyJsonPath: string;
    nodesJsonPath: string;
    edgesJsonPath: string;
  };
}

export interface MissionTaskGraphMaterializationSummary {
  taskGraphId: string;
  executionEngineRunId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  missionId: string;
  statusPath: string;
  reportPath: string;
  markdownPath: string;
  historyPath: string;
  nodesPath: string;
  edgesPath: string;
}
