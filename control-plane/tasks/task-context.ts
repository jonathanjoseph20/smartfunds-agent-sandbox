import type { TaskType } from './task-types.ts';
import type { ExecutionContext } from '../execution/context-types.ts';

export type TaskContext = {
  runId: string;
  phase: string;
  taskId: string;
  taskType: TaskType;
  inputs: Record<string, unknown>;
  executionContext: Readonly<ExecutionContext>;
};
