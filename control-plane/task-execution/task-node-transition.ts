import type { TaskExecutionNodeState } from './task-execution-step-types.ts';
import {
  applyTaskNodeLifecycleTransition,
  assertTaskNodeLifecycleTransition,
} from './task-node-lifecycle.ts';

export function assertTaskNodeTransition(input: {
  from: TaskExecutionNodeState;
  to: TaskExecutionNodeState;
}): void {
  assertTaskNodeLifecycleTransition({
    from: input.from,
    to: input.to,
  });
}

export function applyTaskNodeTransition(input: {
  currentState: TaskExecutionNodeState;
  nextState: TaskExecutionNodeState;
}): TaskExecutionNodeState {
  return applyTaskNodeLifecycleTransition({
    currentState: input.currentState,
    nextState: input.nextState,
  });
}
