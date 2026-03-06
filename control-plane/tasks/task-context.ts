import type { TaskType } from './task-types.ts';

export type TaskContext = {
  runId: string;
  phase: string;
  taskId: string;
  taskType: TaskType;
  inputs: Record<string, unknown>;
  executionContext: Record<string, unknown>;
};
