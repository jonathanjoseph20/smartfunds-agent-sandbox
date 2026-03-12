export const ASSIGNMENT_DEFERRAL_REASONS = [
  'no_compatible_worker',
  'no_capacity',
  'worker_disabled',
  'worker_paused',
  'worker_unavailable',
  'deterministic_ordering_deferred',
] as const;

export const WORKER_QUEUE_STATES = [
  'queued',
  'claimed',
  'running',
  'completed',
  'failed',
  'cancelled',
] as const;

export const WORKER_ASSIGNMENT_STATES = [
  'assigned',
  'deferred',
  'rejected',
  'incompatible',
  'capacity_exhausted',
  'worker_unavailable',
] as const;

export const EXECUTION_ORCHESTRATION_CYCLE_STATES = [
  'evaluating',
  'assigning',
  'waiting_on_results',
  'completed',
  'blocked',
  'incomplete',
] as const;

export const WORKER_CAPACITY_MODES = ['strict', 'bounded_balanced'] as const;
export const WORKER_SELECTION_STRATEGIES = ['lexical', 'balanced_capacity', 'stable_lexical'] as const;
export const ASSIGNMENT_STRATEGIES = ['single_assignment', 'balanced_capacity', 'retry_priority', 'stable_lexical'] as const;
export const RETRY_PRIORITY_MODES = ['after_fresh_ready', 'before_fresh_ready', 'stable_mixed'] as const;

export type AssignmentDeferralReason = typeof ASSIGNMENT_DEFERRAL_REASONS[number];
export type WorkerQueueState = typeof WORKER_QUEUE_STATES[number];
export type WorkerAssignmentState = typeof WORKER_ASSIGNMENT_STATES[number];
export type ExecutionOrchestrationCycleState = typeof EXECUTION_ORCHESTRATION_CYCLE_STATES[number];
export type WorkerCapacityMode = typeof WORKER_CAPACITY_MODES[number];
export type WorkerSelectionStrategy = typeof WORKER_SELECTION_STRATEGIES[number];
export type AssignmentStrategy = typeof ASSIGNMENT_STRATEGIES[number];
export type RetryPriorityMode = typeof RETRY_PRIORITY_MODES[number];

export type WorkerSchedulingPolicy = {
  policyId: string;
  assignmentStrategy: AssignmentStrategy;
  workerSelectionStrategy: WorkerSelectionStrategy;
  workerCapacityMode: WorkerCapacityMode;
  retryPriorityMode: RetryPriorityMode;
  maxAssignmentsPerCycle: number;
  enabled: boolean;
};

export type WorkerAssignmentDecision = {
  assignmentDecisionId: string;
  executionRunId: string;
  taskNodeId: string;
  workerId: string | null;
  cycleIndex: number;
  assignmentState: WorkerAssignmentState;
  selectionReasonTokens: string[];
  deferralReasonTokens: AssignmentDeferralReason[];
  workerCompatibilitySummary: {
    compatibleWorkerIds: string[];
    incompatibleWorkerIds: string[];
  };
  workerCapacitySummary: {
    workerId: string | null;
    maxConcurrentAssignments: number;
    currentAssignedCount: number;
    remainingCapacity: number;
  };
  alternativesConsidered: string[];
  policyId: string;
};

export type WorkerQueueEntry = {
  queueEntryId: string;
  workerId: string;
  taskNodeId: string;
  executionRunId: string;
  assignmentDecisionId: string;
  queueIndex: number;
  queueState: WorkerQueueState;
};

export type WorkerQueueSummary = {
  totalQueued: number;
  inFlight: number;
  completed: number;
  remainingCapacity: number;
};

export type WorkerQueueProjectionState = {
  workerId: string;
  status: 'active' | 'paused' | 'disabled';
  maxConcurrentAssignments: number;
  currentAssignedCount: number;
  queue: WorkerQueueEntry[];
  summary: WorkerQueueSummary;
};

export type ExecutionOrchestrationCycle = {
  orchestrationCycleId: string;
  executionRunId: string;
  taskGraphId: string;
  cycleIndex: number;
  workerSchedulingPolicyId: string;
  runnableNodeIds: string[];
  eligibleWorkerIds: string[];
  assignmentDecisionIds: string[];
  deferredNodeIds: string[];
  completedAssignmentCount: number;
  queueUpdates: number;
  cycleState: ExecutionOrchestrationCycleState;
};

export const TASK_ORCHESTRATION_EVENT_TYPES = [
  'orchestration_cycle_started',
  'orchestration_cycle_completed',
  'worker_assignment_evaluated',
  'worker_assignment_created',
  'worker_assignment_deferred',
  'worker_queue_updated',
  'worker_queue_item_claimed',
  'worker_queue_item_completed',
] as const;

export type TaskOrchestrationEventType = typeof TASK_ORCHESTRATION_EVENT_TYPES[number];

export type TaskOrchestrationHistoryEntry = {
  executionRunId: string;
  taskGraphId: string;
  eventIndex: number;
  eventType: TaskOrchestrationEventType;
  eventPayload: Record<string, unknown>;
  eventDedupeKey: string;
};

export type TaskOrchestrationHistory = {
  executionRunId: string;
  taskGraphId: string;
  entries: TaskOrchestrationHistoryEntry[];
};

export type TaskOrchestrationProjection = {
  executionRunId: string;
  taskGraphId: string;
  currentCycleIndex: number;
  cycleState: ExecutionOrchestrationCycleState;
  cycles: ExecutionOrchestrationCycle[];
  assignments: WorkerAssignmentDecision[];
  deferredNodes: Array<{ taskNodeId: string; reasonTokens: AssignmentDeferralReason[] }>;
  workerQueues: WorkerQueueProjectionState[];
  workerLoad: Array<{
    workerId: string;
    status: 'active' | 'paused' | 'disabled';
    maxConcurrentAssignments: number;
    currentAssignedCount: number;
    remainingCapacity: number;
  }>;
};
