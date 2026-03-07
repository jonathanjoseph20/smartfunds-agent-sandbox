import type { ExecutionEvent } from '../journal/types.ts';
import type { WorkflowNodeRecord } from './node-record.ts';
import { buildWorkflowNodeRecords } from './node-record.ts';
import { sanitizeNullableString, toPlainObject, withoutUndefined, type JsonValue } from './serialization.ts';

export type WorkflowTraceType =
  | 'RUN_STARTED'
  | 'NODE_BECAME_RUNNABLE'
  | 'NODE_STARTED'
  | 'NODE_COMPLETED'
  | 'NODE_FAILED'
  | 'NODE_RETRY_SCHEDULED'
  | 'NODE_RETRY_STARTED'
  | 'NODE_RETRY_EXHAUSTED'
  | 'NODE_TIMEOUT'
  | 'ADAPTER_TIMEOUT'
  | 'WORKFLOW_RECOVERY_STARTED'
  | 'WORKFLOW_RECOVERY_RESUMED'
  | 'WORKFLOW_CANCELLED'
  | 'WORKFLOW_TIMEOUT'
  | 'SAFETY_LIMIT_VIOLATION'
  | 'RUN_COMPLETED'
  | 'RUN_FAILED';

export type WorkflowTraceEntry = {
  sequence: number;
  type: WorkflowTraceType;
  runId: string;
  workflowId: string;
  nodeId: string | null;
  agentId: string | null;
  adapterId: string | null;
  status: string | null;
  details: Record<string, JsonValue>;
};

function eventPayloadObject(event: ExecutionEvent): Record<string, unknown> {
  return typeof event.payload === 'object' && event.payload !== null && !Array.isArray(event.payload)
    ? event.payload
    : {};
}

function toEntry(input: WorkflowTraceEntry): WorkflowTraceEntry {
  return withoutUndefined(input);
}

function appendRunnableEntries(input: {
  entries: WorkflowTraceEntry[];
  runId: string;
  workflowId: string;
  sequence: number;
  nodes: WorkflowNodeRecord[];
  completedNodeIds: Set<string>;
  announcedNodeIds: Set<string>;
}): void {
  const candidates = input.nodes
    .filter((node) => node.sequenceStarted <= input.sequence)
    .filter((node) => !input.announcedNodeIds.has(node.nodeId))
    .filter((node) => node.dependsOn.every((dependency) => input.completedNodeIds.has(dependency)))
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId));

  for (const node of candidates) {
    input.entries.push(toEntry({
      sequence: input.sequence,
      type: 'NODE_BECAME_RUNNABLE',
      runId: input.runId,
      workflowId: input.workflowId,
      nodeId: node.nodeId,
      agentId: node.agentId,
      adapterId: node.adapterId,
      status: node.status,
      details: {
        dependsOn: node.dependsOn
      }
    }));
    input.announcedNodeIds.add(node.nodeId);
  }
}

export function buildWorkflowTrace(input: {
  runId: string;
  workflowId: string;
  events: ExecutionEvent[];
  nodeRecords?: WorkflowNodeRecord[];
}): WorkflowTraceEntry[] {
  const orderedEvents = [...input.events].sort((left, right) => left.sequence - right.sequence);
  const nodes = input.nodeRecords ?? buildWorkflowNodeRecords({
    runId: input.runId,
    workflowId: input.workflowId,
    events: orderedEvents
  });

  const entries: WorkflowTraceEntry[] = [];
  const completedNodeIds = new Set<string>();
  const announcedNodeIds = new Set<string>();

  for (const event of orderedEvents) {
    const payload = eventPayloadObject(event);

    if (event.type === 'RUN_CREATED') {
      entries.push(toEntry({
        sequence: event.sequence,
        type: 'RUN_STARTED',
        runId: input.runId,
        workflowId: input.workflowId,
        nodeId: null,
        agentId: null,
        adapterId: null,
        status: 'running',
        details: toPlainObject(payload)
      }));
      appendRunnableEntries({
        entries,
        runId: input.runId,
        workflowId: input.workflowId,
        sequence: event.sequence,
        nodes,
        completedNodeIds,
        announcedNodeIds
      });
      continue;
    }

    if (event.type === 'TASK_STARTED') {
      const nodeId = sanitizeNullableString(event.taskId);
      if (nodeId) {
        entries.push(toEntry({
          sequence: event.sequence,
          type: 'NODE_STARTED',
          runId: input.runId,
          workflowId: input.workflowId,
          nodeId,
          agentId: sanitizeNullableString(payload.agentId),
          adapterId: sanitizeNullableString(payload.adapterId),
          status: 'running',
          details: toPlainObject(payload)
        }));
      }
      continue;
    }

    if (event.type === 'TASK_COMPLETED') {
      const nodeId = sanitizeNullableString(event.taskId);
      if (nodeId) {
        completedNodeIds.add(nodeId);
        entries.push(toEntry({
          sequence: event.sequence,
          type: 'NODE_COMPLETED',
          runId: input.runId,
          workflowId: input.workflowId,
          nodeId,
          agentId: sanitizeNullableString(payload.agentId),
          adapterId: sanitizeNullableString(payload.adapterId),
          status: 'completed',
          details: toPlainObject(payload)
        }));

        appendRunnableEntries({
          entries,
          runId: input.runId,
          workflowId: input.workflowId,
          sequence: event.sequence,
          nodes,
          completedNodeIds,
          announcedNodeIds
        });
      }
      continue;
    }

    if (event.type === 'TASK_FAILED') {
      const nodeId = sanitizeNullableString(event.taskId);
      entries.push(toEntry({
        sequence: event.sequence,
        type: 'NODE_FAILED',
        runId: input.runId,
        workflowId: input.workflowId,
        nodeId,
        agentId: sanitizeNullableString(payload.agentId),
        adapterId: sanitizeNullableString(payload.adapterId),
        status: 'failed',
        details: toPlainObject(payload)
      }));
      continue;
    }

    if (event.type === 'NODE_RETRY_SCHEDULED') {
      entries.push(toEntry({
        sequence: event.sequence,
        type: 'NODE_RETRY_SCHEDULED',
        runId: input.runId,
        workflowId: input.workflowId,
        nodeId: sanitizeNullableString(event.taskId),
        agentId: sanitizeNullableString(payload.agentId),
        adapterId: sanitizeNullableString(payload.adapterId),
        status: 'retrying',
        details: toPlainObject(payload)
      }));
      continue;
    }

    if (event.type === 'NODE_RETRY_STARTED') {
      entries.push(toEntry({
        sequence: event.sequence,
        type: 'NODE_RETRY_STARTED',
        runId: input.runId,
        workflowId: input.workflowId,
        nodeId: sanitizeNullableString(event.taskId),
        agentId: sanitizeNullableString(payload.agentId),
        adapterId: sanitizeNullableString(payload.adapterId),
        status: 'running',
        details: toPlainObject(payload)
      }));
      continue;
    }

    if (event.type === 'NODE_RETRY_EXHAUSTED') {
      entries.push(toEntry({
        sequence: event.sequence,
        type: 'NODE_RETRY_EXHAUSTED',
        runId: input.runId,
        workflowId: input.workflowId,
        nodeId: sanitizeNullableString(event.taskId),
        agentId: sanitizeNullableString(payload.agentId),
        adapterId: sanitizeNullableString(payload.adapterId),
        status: 'failed',
        details: toPlainObject(payload)
      }));
      continue;
    }

    if (event.type === 'NODE_TIMEOUT' || event.type === 'ADAPTER_TIMEOUT') {
      entries.push(toEntry({
        sequence: event.sequence,
        type: event.type,
        runId: input.runId,
        workflowId: input.workflowId,
        nodeId: sanitizeNullableString(event.taskId),
        agentId: sanitizeNullableString(payload.agentId),
        adapterId: sanitizeNullableString(payload.adapterId),
        status: 'timeout',
        details: toPlainObject(payload)
      }));
      continue;
    }

    if (event.type === 'WORKFLOW_RECOVERY_STARTED' || event.type === 'WORKFLOW_RECOVERY_RESUMED' || event.type === 'WORKFLOW_CANCELLED' || event.type === 'WORKFLOW_TIMEOUT' || event.type === 'SAFETY_LIMIT_VIOLATION') {
      entries.push(toEntry({
        sequence: event.sequence,
        type: event.type,
        runId: input.runId,
        workflowId: input.workflowId,
        nodeId: sanitizeNullableString(event.taskId),
        agentId: null,
        adapterId: null,
        status: event.type === 'WORKFLOW_CANCELLED'
          ? 'cancelled'
          : event.type === 'WORKFLOW_TIMEOUT'
            ? 'timeout'
            : 'running',
        details: toPlainObject(payload)
      }));
      continue;
    }

    if (event.type === 'RUN_COMPLETED') {
      entries.push(toEntry({
        sequence: event.sequence,
        type: 'RUN_COMPLETED',
        runId: input.runId,
        workflowId: input.workflowId,
        nodeId: null,
        agentId: null,
        adapterId: null,
        status: 'completed',
        details: toPlainObject(payload)
      }));
      continue;
    }

    if (event.type === 'RUN_FAILED') {
      entries.push(toEntry({
        sequence: event.sequence,
        type: 'RUN_FAILED',
        runId: input.runId,
        workflowId: input.workflowId,
        nodeId: sanitizeNullableString(event.taskId),
        agentId: null,
        adapterId: null,
        status: 'failed',
        details: toPlainObject(payload)
      }));
      break;
    }
  }

  const dedupe = new Set<string>();
  return entries
    .filter((entry) => {
      const key = `${entry.sequence}|${entry.type}|${entry.nodeId ?? ''}`;
      if (dedupe.has(key)) {
        return false;
      }
      dedupe.add(key);
      return true;
    });
}
