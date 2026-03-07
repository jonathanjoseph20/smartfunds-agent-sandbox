export const WORKFLOW_NODE_STATES = [
  'pending',
  'ready',
  'running',
  'completed',
  'failed',
  'timeout',
  'retrying',
  'skipped'
] as const;

export type WorkflowNodeState = (typeof WORKFLOW_NODE_STATES)[number];

export const WORKFLOW_RUN_STATES = [
  'created',
  'running',
  'completed',
  'failed',
  'cancelled',
  'timeout',
  'recovering'
] as const;

export type WorkflowRunState = (typeof WORKFLOW_RUN_STATES)[number];

const NODE_TRANSITIONS: Readonly<Record<WorkflowNodeState, readonly WorkflowNodeState[]>> = {
  pending: ['ready', 'skipped'],
  ready: ['running', 'skipped'],
  running: ['completed', 'failed', 'timeout', 'retrying'],
  completed: [],
  failed: ['retrying', 'skipped'],
  timeout: ['retrying', 'failed', 'skipped'],
  retrying: ['ready', 'running', 'failed', 'timeout'],
  skipped: []
};

const RUN_TRANSITIONS: Readonly<Record<WorkflowRunState, readonly WorkflowRunState[]>> = {
  created: ['running', 'recovering', 'cancelled'],
  running: ['completed', 'failed', 'cancelled', 'timeout', 'recovering'],
  completed: [],
  failed: ['recovering'],
  cancelled: [],
  timeout: ['recovering', 'failed'],
  recovering: ['running', 'failed', 'cancelled', 'timeout', 'completed']
};

export const FAILURE_STATE_ERROR_CODES = {
  INVALID_NODE_STATE: 'ERR_INVALID_WORKFLOW_NODE_STATE',
  INVALID_RUN_STATE: 'ERR_INVALID_WORKFLOW_RUN_STATE',
  INVALID_NODE_TRANSITION: 'ERR_INVALID_WORKFLOW_NODE_TRANSITION',
  INVALID_RUN_TRANSITION: 'ERR_INVALID_WORKFLOW_RUN_TRANSITION'
} as const;

export class WorkflowStateError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'WorkflowStateError';
    this.code = code;
  }
}

export function isWorkflowNodeState(value: string): value is WorkflowNodeState {
  return (WORKFLOW_NODE_STATES as readonly string[]).includes(value);
}

export function isWorkflowRunState(value: string): value is WorkflowRunState {
  return (WORKFLOW_RUN_STATES as readonly string[]).includes(value);
}

export function assertWorkflowNodeState(value: string): WorkflowNodeState {
  if (!isWorkflowNodeState(value)) {
    throw new WorkflowStateError(
      FAILURE_STATE_ERROR_CODES.INVALID_NODE_STATE,
      `Invalid workflow node state: ${value}`
    );
  }

  return value;
}

export function assertWorkflowRunState(value: string): WorkflowRunState {
  if (!isWorkflowRunState(value)) {
    throw new WorkflowStateError(
      FAILURE_STATE_ERROR_CODES.INVALID_RUN_STATE,
      `Invalid workflow state: ${value}`
    );
  }

  return value;
}

export function canTransitionWorkflowNodeState(from: WorkflowNodeState, to: WorkflowNodeState): boolean {
  return NODE_TRANSITIONS[from].includes(to);
}

export function canTransitionWorkflowRunState(from: WorkflowRunState, to: WorkflowRunState): boolean {
  return RUN_TRANSITIONS[from].includes(to);
}

export function assertWorkflowNodeTransition(from: WorkflowNodeState, to: WorkflowNodeState): void {
  if (!canTransitionWorkflowNodeState(from, to)) {
    throw new WorkflowStateError(
      FAILURE_STATE_ERROR_CODES.INVALID_NODE_TRANSITION,
      `Invalid workflow node state transition: ${from} -> ${to}`
    );
  }
}

export function assertWorkflowRunTransition(from: WorkflowRunState, to: WorkflowRunState): void {
  if (!canTransitionWorkflowRunState(from, to)) {
    throw new WorkflowStateError(
      FAILURE_STATE_ERROR_CODES.INVALID_RUN_TRANSITION,
      `Invalid workflow state transition: ${from} -> ${to}`
    );
  }
}
