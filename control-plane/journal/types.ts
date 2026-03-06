export const EVENT_TYPES = [
  'RUN_CREATED',
  'PHASE_STARTED',
  'PHASE_COMPLETED',
  'TASK_STARTED',
  'TASK_COMPLETED',
  'TASK_FAILED',
  'ARTIFACT_RECORDED',
  'RUN_COMPLETED',
  'RUN_FAILED'
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const EXECUTION_PHASES = [
  'plan',
  'setup',
  'implement',
  'verify',
  'test',
  'release'
] as const;

export type ExecutionPhase = (typeof EXECUTION_PHASES)[number];

export const RUN_KINDS = ['swarm', 'mission', 'maintenance', 'governance'] as const;
export type RunKind = (typeof RUN_KINDS)[number];

export const RUN_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export type ExecutionRun = {
  runId: string;
  projectId: string;
  entity: string;
  pod: string;
  mode: string;
  kind: RunKind;
  status: RunStatus;
  entrypoint: string;
  createdIndex: number;
};

export type ExecutionEvent = {
  runId: string;
  eventId: string;
  sequence: number;
  type: EventType;
  phase: ExecutionPhase;
  taskId?: string | null;
  artifactId?: string | null;
  payload: Record<string, unknown>;
};

export type ArtifactRecord = {
  artifactId: string;
  kind: string;
  path: string;
  producerTaskId: string;
};

export type RunSummary = {
  status: RunStatus;
  currentPhase: ExecutionPhase | null;
  lastCompletedPhase: ExecutionPhase | null;
  totalEvents: number;
  tasksCompleted: number;
  tasksFailed: number;
  artifactsProduced: number;
};

export type CreateRunInput = {
  projectId: string;
  entity: string;
  pod: string;
  mode: string;
  kind: RunKind;
  entrypoint: string;
};

export type AppendEventInput = {
  sequence: number;
  type: EventType;
  phase: ExecutionPhase;
  taskId?: string | null;
  artifactId?: string | null;
  payload?: Record<string, unknown>;
};
