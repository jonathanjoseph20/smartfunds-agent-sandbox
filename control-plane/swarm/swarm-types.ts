import type { ExecutionPhase, ExecutionRun, ExecutionEvent } from '../journal/types.ts';
import type { TaskType } from '../tasks/task-types.ts';
import type { ExecutionContext } from '../execution/context-types.ts';

export const SWARM_PHASES = [
  'plan',
  'setup',
  'implement',
  'verify',
  'test',
  'release'
] as const;

export type SwarmPhase = (typeof SWARM_PHASES)[number];

export const SWARM_RUN_STATUSES = ['created', 'running', 'completed', 'failed'] as const;
export type SwarmRunStatus = (typeof SWARM_RUN_STATUSES)[number];

export const SWARM_TASK_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
export type SwarmTaskStatus = (typeof SWARM_TASK_STATUSES)[number];

export type SwarmTaskExecutor = () => void;

export type SwarmTaskDefinition = {
  taskId: string;
  phase: SwarmPhase;
  description: string;
  order: number;
  type: TaskType;
  inputs: Record<string, unknown>;
  agent?: string;
  executionContext?: ExecutionContext;
  executor?: SwarmTaskExecutor;
};

export type SwarmEntrypoint = {
  name: string;
};

export type SwarmRunDefinition = {
  runId: string;
  projectId: string;
  entity: string;
  pod: string;
  mode: string;
  kind: string;
  entrypoint: SwarmEntrypoint;
  phases: SwarmPhase[];
  tasksByPhase: Record<SwarmPhase, SwarmTaskDefinition[]>;
};

export type SwarmPhaseSummary = {
  phase: SwarmPhase;
  status: 'pending' | 'running' | 'completed' | 'failed';
};

export type SwarmTaskSummary = {
  taskId: string;
  phase: SwarmPhase;
  status: SwarmTaskStatus;
  order: number;
  description: string;
};

export type SwarmRunSummary = {
  runId: string;
  projectId: string;
  entity: string;
  pod: string;
  mode: string;
  kind: string;
  status: SwarmRunStatus;
  currentPhase: SwarmPhase | null;
  completedPhases: SwarmPhase[];
  failedPhase?: SwarmPhase;
  phaseSummaries: SwarmPhaseSummary[];
  taskSummaries: SwarmTaskSummary[];
  eventCount: number;
};

export type SwarmJournalEvent = Pick<ExecutionEvent, 'runId' | 'sequence' | 'type' | 'phase' | 'taskId' | 'payload'>;

export type SwarmRunRecord = Pick<ExecutionRun, 'runId' | 'projectId' | 'entity' | 'pod' | 'mode' | 'kind'>;

export function isSwarmPhase(value: ExecutionPhase): value is SwarmPhase {
  return SWARM_PHASES.includes(value as SwarmPhase);
}
