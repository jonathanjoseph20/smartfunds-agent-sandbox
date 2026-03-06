import type { TaskContext } from './task-context.ts';
import type { TaskResult } from './task-result.ts';
import type { TaskType } from './task-types.ts';

export interface AgentTaskAdapter {
  type: TaskType;
  execute(context: TaskContext): Promise<TaskResult>;
}
