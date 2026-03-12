import type { TaskExecutionNodeState } from './task-execution-step-types.ts';

const ALLOWED_TRANSITIONS: Record<TaskExecutionNodeState, TaskExecutionNodeState[]> = {
  pending: ['ready', 'blocked'],
  ready: ['running'],
  running: ['completed', 'failed'],
  completed: [],
  failed: ['retrying', 'permanently_failed'],
  retrying: ['ready'],
  permanently_failed: [],
  blocked: [],
  skipped: [],
};

export function assertTaskNodeLifecycleTransition(input: {
  from: TaskExecutionNodeState;
  to: TaskExecutionNodeState;
}): void {
  const allowed = ALLOWED_TRANSITIONS[input.from] ?? [];
  if (!allowed.includes(input.to)) {
    throw new Error('INVALID_TASK_NODE_TRANSITION');
  }
}

export function applyTaskNodeLifecycleTransition(input: {
  currentState: TaskExecutionNodeState;
  nextState: TaskExecutionNodeState;
}): TaskExecutionNodeState {
  assertTaskNodeLifecycleTransition({
    from: input.currentState,
    to: input.nextState,
  });

  return input.nextState;
}
