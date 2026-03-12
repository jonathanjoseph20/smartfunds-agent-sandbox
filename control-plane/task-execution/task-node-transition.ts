import type { TaskExecutionNodeState } from './task-execution-step-types.ts';

const ALLOWED_TRANSITIONS: Record<TaskExecutionNodeState, TaskExecutionNodeState[]> = {
  pending: ['ready'],
  ready: ['running'],
  running: ['completed', 'failed'],
  completed: [],
  failed: [],
  blocked: [],
  skipped: [],
};

export function assertTaskNodeTransition(input: {
  from: TaskExecutionNodeState;
  to: TaskExecutionNodeState;
}): void {
  const allowed = ALLOWED_TRANSITIONS[input.from] ?? [];
  if (!allowed.includes(input.to)) {
    throw new Error('INVALID_TASK_NODE_TRANSITION');
  }
}

export function applyTaskNodeTransition(input: {
  currentState: TaskExecutionNodeState;
  nextState: TaskExecutionNodeState;
}): TaskExecutionNodeState {
  assertTaskNodeTransition({
    from: input.currentState,
    to: input.nextState,
  });

  return input.nextState;
}
