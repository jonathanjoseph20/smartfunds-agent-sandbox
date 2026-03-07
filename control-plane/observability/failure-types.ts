import { sanitizeNullableString, toPlainObject, withoutUndefined, type JsonValue } from './serialization.ts';

export const WORKFLOW_FAILURE_CODES = [
  'DEPENDENCY_UNSATISFIED',
  'AGENT_RESOLUTION_FAILED',
  'TOOL_PERMISSION_DENIED',
  'ADAPTER_EXECUTION_FAILED',
  'TASK_RESULT_INVALID',
  'CONTEXT_MERGE_FAILED',
  'WORKFLOW_VALIDATION_FAILED',
  'UNKNOWN_RUNTIME_FAILURE'
] as const;

export type WorkflowFailureCode = (typeof WORKFLOW_FAILURE_CODES)[number];

export type WorkflowFailureRecord = {
  code: WorkflowFailureCode;
  message: string;
  nodeId: string | null;
  agentId: string | null;
  adapterId: string | null;
  details: Record<string, JsonValue>;
  remediationHint?: string;
};

function mapMessageToFailureCode(message: string): WorkflowFailureCode {
  if (message.includes('ERR_TASK_DEPENDENCY_UNSATISFIED') || message.includes('workflow.execution_stalled')) {
    return 'DEPENDENCY_UNSATISFIED';
  }
  if (message.includes('ERR_TASK_AGENT_') || message.includes('TASK_AGENT_RESOLUTION_FAILED')) {
    return 'AGENT_RESOLUTION_FAILED';
  }
  if (message.includes('ERR_AGENT_TOOL_NOT_ALLOWED') || message.includes('permission denied')) {
    return 'TOOL_PERMISSION_DENIED';
  }
  if (message.includes('ERR_TASK_ADAPTER_EXECUTION') || message.includes('ERR_TASK_EXECUTOR_FAILED')) {
    return 'ADAPTER_EXECUTION_FAILED';
  }
  if (message.includes('ERR_TASK_RESULT_INVALID')) {
    return 'TASK_RESULT_INVALID';
  }
  if (message.includes('ERR_CONTEXT_MERGE_FAILED')) {
    return 'CONTEXT_MERGE_FAILED';
  }
  if (message.includes('workflow.schema_invalid') || message.includes('workflow.dag_invalid')) {
    return 'WORKFLOW_VALIDATION_FAILED';
  }
  return 'UNKNOWN_RUNTIME_FAILURE';
}

function remediationHintForCode(code: WorkflowFailureCode): string | undefined {
  if (code === 'DEPENDENCY_UNSATISFIED') {
    return 'Inspect dependency completion state for the failed node.';
  }
  if (code === 'AGENT_RESOLUTION_FAILED') {
    return 'Inspect agent roster and node-to-agent binding.';
  }
  if (code === 'TOOL_PERMISSION_DENIED') {
    return 'Inspect agent tool policy and adapter allow-list.';
  }
  if (code === 'ADAPTER_EXECUTION_FAILED') {
    return 'Inspect adapter error payload and task inputs.';
  }
  if (code === 'TASK_RESULT_INVALID') {
    return 'Inspect adapter output contract for deterministic schema compliance.';
  }
  if (code === 'CONTEXT_MERGE_FAILED') {
    return 'Inspect context updates and merge compatibility.';
  }
  if (code === 'WORKFLOW_VALIDATION_FAILED') {
    return 'Inspect workflow definition DAG and schema validation errors.';
  }
  return undefined;
}

function normalizeMessage(value: unknown): string {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }
  return 'workflow_runtime_failure';
}

export function createWorkflowFailureRecord(input: {
  message: unknown;
  nodeId?: unknown;
  agentId?: unknown;
  adapterId?: unknown;
  code?: WorkflowFailureCode;
  details?: unknown;
  includeHint?: boolean;
}): WorkflowFailureRecord {
  const message = normalizeMessage(input.message);
  const code = input.code ?? mapMessageToFailureCode(message);
  const hint = input.includeHint ? remediationHintForCode(code) : undefined;

  return withoutUndefined({
    code,
    message,
    nodeId: sanitizeNullableString(input.nodeId),
    agentId: sanitizeNullableString(input.agentId),
    adapterId: sanitizeNullableString(input.adapterId),
    details: toPlainObject(input.details),
    remediationHint: hint
  });
}

export function classifyWorkflowFailureCode(message: string): WorkflowFailureCode {
  return mapMessageToFailureCode(message);
}
