export type RunLifecycleState =
  | 'CREATED'
  | 'NO_WORK'
  | 'RUNNING'
  | 'FAILED'
  | 'SUCCEEDED'
  | 'RETRY_SCHEDULED'
  | 'RETRY_RUNNING'
  | 'RETRY_FAILED'
  | 'RETRY_SUCCEEDED';

export const TERMINAL_LIFECYCLE_STATES = ['NO_WORK', 'SUCCEEDED', 'RETRY_SUCCEEDED', 'RETRY_FAILED'] as const;

export const LIFECYCLE_ERROR_CODES = {
  INVALID_TRANSITION: 'ERR_INVALID_RUN_LIFECYCLE_TRANSITION'
} as const;

const ALLOWED_TRANSITIONS: Readonly<Record<RunLifecycleState, readonly RunLifecycleState[]>> = {
  CREATED: ['NO_WORK', 'RUNNING'],
  NO_WORK: [],
  RUNNING: ['SUCCEEDED', 'FAILED'],
  FAILED: ['RETRY_SCHEDULED'],
  RETRY_SCHEDULED: ['RETRY_RUNNING'],
  RETRY_RUNNING: ['RETRY_SUCCEEDED', 'RETRY_FAILED'],
  SUCCEEDED: [],
  RETRY_SUCCEEDED: [],
  RETRY_FAILED: []
};

export class LifecycleTransitionError extends Error {
  public readonly code = LIFECYCLE_ERROR_CODES.INVALID_TRANSITION;

  constructor(previousState: RunLifecycleState, nextState: RunLifecycleState) {
    super(`Invalid run lifecycle transition: ${previousState} -> ${nextState}`);
    this.name = 'LifecycleTransitionError';
  }
}

export function isValidLifecycleTransition(previousState: RunLifecycleState, nextState: RunLifecycleState): boolean {
  const allowed = ALLOWED_TRANSITIONS[previousState];
  return allowed.includes(nextState);
}

export function assertValidLifecycleTransition(previousState: RunLifecycleState, nextState: RunLifecycleState): void {
  if (!isValidLifecycleTransition(previousState, nextState)) {
    throw new LifecycleTransitionError(previousState, nextState);
  }
}

export function isTerminalLifecycleState(state: RunLifecycleState): boolean {
  return (TERMINAL_LIFECYCLE_STATES as readonly string[]).includes(state);
}
