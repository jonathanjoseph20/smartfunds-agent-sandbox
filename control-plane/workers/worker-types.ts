export const WORKER_STATUSES = ['active', 'paused', 'disabled'] as const;

export type WorkerStatus = typeof WORKER_STATUSES[number];
export type WorkerType = string;
export type WorkerCapability = string;

export interface WorkerDefinition {
  workerId: string;
  workerType: WorkerType;
  supportedTaskTypes: string[];
  capabilities: WorkerCapability[];
  version?: string;
  status: WorkerStatus;
  maxConcurrentAssignments: number;
}
