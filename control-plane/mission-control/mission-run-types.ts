export const MISSION_OPERATIONAL_STATES = [
  'pending',
  'active',
  'retrying',
  'blocked',
  'degraded',
  'completed',
  'failed',
  'cancelled',
  'inconclusive',
] as const;

export const MISSION_COMPLETION_STATES = [
  'not_started',
  'in_progress',
  'partially_complete',
  'blocked',
  'completed',
  'failed',
  'inconclusive',
] as const;

export const MISSION_HEALTH_STATES = [
  'healthy',
  'degraded',
  'unstable',
  'blocked',
  'failed',
  'inconclusive',
] as const;

export const MISSION_ESCALATION_CLASSES = [
  'retry_exhaustion',
  'terminal_node_failure',
  'orchestration_deadlock',
  'worker_capacity_exhausted',
  'worker_compatibility_gap',
  'policy_failure',
  'unresolved_blocking_chain',
] as const;

export const MISSION_ESCALATION_STATES = [
  'open',
  'acknowledged',
  'resolved',
  'suppressed',
] as const;

export const MISSION_RUN_HISTORY_EVENT_TYPES = [
  'mission_run_created',
  'mission_execution_started',
  'mission_progress_updated',
  'mission_blocked',
  'mission_degraded',
  'mission_escalated',
  'mission_completed',
  'mission_failed',
  'mission_cancelled',
] as const;

export type MissionOperationalState = typeof MISSION_OPERATIONAL_STATES[number];
export type MissionCompletionState = typeof MISSION_COMPLETION_STATES[number];
export type MissionHealthState = typeof MISSION_HEALTH_STATES[number];
export type MissionEscalationClass = typeof MISSION_ESCALATION_CLASSES[number];
export type MissionEscalationState = typeof MISSION_ESCALATION_STATES[number];
export type MissionRunHistoryEventType = typeof MISSION_RUN_HISTORY_EVENT_TYPES[number];

export interface MissionProgressSummary {
  totalTaskCount: number;
  pendingTaskCount: number;
  readyTaskCount: number;
  runningTaskCount: number;
  retryingTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  blockedTaskCount: number;
  skippedTaskCount: number;
  completionPercent: number;
  criticalPathState: 'clear' | 'constrained' | 'blocked' | 'failed' | 'inconclusive';
  remainingBlockingNodes: string[];
}

export interface MissionEscalation {
  missionRunId: string;
  escalationId: string;
  escalationClass: MissionEscalationClass;
  severity: 'low' | 'medium' | 'high' | 'critical';
  linkedTaskNodeIds: string[];
  linkedExecutionEventIds: string[];
  reasonTokens: string[];
  state: MissionEscalationState;
}

export interface MissionRunStatus {
  missionRunId: string;
  missionId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  operationalState: MissionOperationalState;
  completionState: MissionCompletionState;
  healthState: MissionHealthState;
  reasonTokens: string[];
}

export interface MissionRun {
  missionRunId: string;
  missionId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  operationalState: MissionOperationalState;
  completionState: MissionCompletionState;
  healthState: MissionHealthState;
  progressSummary: MissionProgressSummary;
  escalations: MissionEscalation[];
}

export interface MissionRunHistoryEntry {
  missionRunId: string;
  missionId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  eventType: MissionRunHistoryEventType;
  eventDedupeKey: string;
  reason: string;
  payload: Record<string, unknown>;
}

export interface MissionRunHistory {
  missionRunId: string;
  missionId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  entries: MissionRunHistoryEntry[];
}

export interface MissionRunProjection {
  missionRunId: string;
  missionId: string;
  executionAttemptId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  operationalState: MissionOperationalState;
  completionState: MissionCompletionState;
  healthState: MissionHealthState;
  progressSummary: MissionProgressSummary;
  escalations: MissionEscalation[];
  blockingReasons: string[];
  workerLoadSummary: Array<{
    workerId: string;
    status: 'active' | 'paused' | 'disabled';
    maxConcurrentAssignments: number;
    currentAssignedCount: number;
    remainingCapacity: number;
  }>;
  lastExecutionEventId: string | null;
  lastOrchestrationCycleIndex: number;
  statusPreview: Record<string, unknown>;
  reportPreview: Record<string, unknown>;
  artifactPaths: {
    dirPath: string;
    statusJsonPath: string;
    progressJsonPath: string;
    reportJsonPath: string;
    reportMarkdownPath: string;
    historyJsonPath: string;
    escalationsJsonPath: string;
    healthJsonPath: string;
  };
}
