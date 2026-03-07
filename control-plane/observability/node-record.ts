import type { ExecutionEvent } from '../journal/types.ts';
import type { WorkflowNode } from '../workflows/workflow-types.ts';
import { loadWorkflowDefinitionById } from '../workflows/workflow-loader.ts';
import { createWorkflowFailureRecord, type WorkflowFailureRecord } from './failure-types.ts';
import {
  canonicalJson,
  normalizeJson,
  sanitizeNullableString,
  stableSortStrings,
  toPlainObject,
  type JsonValue
} from './serialization.ts';

export type WorkflowNodeStatus = 'pending' | 'running' | 'completed' | 'failed';

export type WorkflowNodeRecord = {
  runId: string;
  workflowId: string;
  nodeId: string;
  agentId: string | null;
  adapterId: string | null;
  status: WorkflowNodeStatus;
  dependsOn: string[];
  sequenceStarted: number;
  sequenceCompleted: number | null;
  taskInputs: Record<string, JsonValue>;
  taskOutputs: Record<string, JsonValue>;
  previousOutputs: Record<string, JsonValue>;
  contextSnapshot: Record<string, JsonValue>;
  failure: WorkflowFailureRecord | null;
};

type NodeAccumulator = {
  nodeId: string;
  sequenceStarted: number;
  sequenceCompleted: number | null;
  startedPayload: Record<string, unknown>;
  completionPayload: Record<string, unknown>;
  status: WorkflowNodeStatus;
  agentId: string | null;
  adapterId: string | null;
  failure: WorkflowFailureRecord | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNodeIdFromEvent(event: ExecutionEvent): string | null {
  return sanitizeNullableString(event.taskId);
}

function payloadTaskInputs(payload: Record<string, unknown>): Record<string, JsonValue> {
  const source = isRecord(payload.task_inputs)
    ? payload.task_inputs
    : (isRecord(payload.inputs) ? payload.inputs : {});
  return toPlainObject(source);
}

function payloadTaskOutputs(payload: Record<string, unknown>): Record<string, JsonValue> {
  if (isRecord(payload.task_outputs)) {
    return toPlainObject(payload.task_outputs);
  }

  if (isRecord(payload.result) && isRecord(payload.result.outputs)) {
    return toPlainObject(payload.result.outputs);
  }

  return {};
}

function payloadContextSnapshot(payload: Record<string, unknown>): Record<string, JsonValue> {
  if (!isRecord(payload.context_snapshot)) {
    return {};
  }
  return toPlainObject(payload.context_snapshot);
}

function payloadPreviousOutputs(snapshot: Record<string, JsonValue>): Record<string, JsonValue> {
  const memory = snapshot.memory;
  if (!memory || typeof memory !== 'object' || Array.isArray(memory)) {
    return {};
  }

  const previous = (memory as Record<string, unknown>).previousOutputs;
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)) {
    return {};
  }

  return toPlainObject(previous);
}

function deriveWorkflowNodeMap(workflowId: string): Map<string, WorkflowNode> {
  try {
    const workflow = loadWorkflowDefinitionById(workflowId);
    return new Map(workflow.nodes.map((node) => [node.id, node]));
  } catch {
    return new Map();
  }
}

function getDependsOn(nodeMap: Map<string, WorkflowNode>, nodeId: string): string[] {
  const node = nodeMap.get(nodeId);
  if (!node || !Array.isArray(node.dependsOn)) {
    return [];
  }
  return stableSortStrings(node.dependsOn.filter((entry): entry is string => typeof entry === 'string'));
}

function getWorkflowIdFromEvents(events: ExecutionEvent[]): string {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const payload = ordered[index].payload;
    if (!isRecord(payload) || !isRecord(payload.context_snapshot)) {
      continue;
    }

    const snapshot = payload.context_snapshot;
    if (!isRecord(snapshot.metadata)) {
      continue;
    }

    const workflowId = sanitizeNullableString(snapshot.metadata.workflowId);
    if (workflowId) {
      return workflowId;
    }
  }

  const runCreated = ordered.find((event) => event.type === 'RUN_CREATED');
  if (runCreated && runCreated.payload && typeof runCreated.payload.entrypoint === 'string') {
    const entrypoint = runCreated.payload.entrypoint;
    if (entrypoint.startsWith('workflow:')) {
      const [, workflowId] = entrypoint.split(':');
      if (workflowId) {
        return workflowId;
      }
    }
  }

  return 'unknown-workflow';
}

export function buildWorkflowNodeRecords(input: {
  runId: string;
  events: ExecutionEvent[];
  workflowId?: string;
}): WorkflowNodeRecord[] {
  const orderedEvents = [...input.events].sort((left, right) => left.sequence - right.sequence);
  const workflowId = input.workflowId ?? getWorkflowIdFromEvents(orderedEvents);
  const nodeMap = deriveWorkflowNodeMap(workflowId);
  const recordsByNodeId = new Map<string, NodeAccumulator>();

  for (const event of orderedEvents) {
    if (event.type !== 'TASK_STARTED' && event.type !== 'TASK_COMPLETED' && event.type !== 'TASK_FAILED') {
      continue;
    }

    const nodeId = getNodeIdFromEvent(event);
    if (!nodeId) {
      continue;
    }

    const payload = isRecord(event.payload) ? event.payload : {};
    const current = recordsByNodeId.get(nodeId) ?? {
      nodeId,
      sequenceStarted: event.sequence,
      sequenceCompleted: null,
      startedPayload: {},
      completionPayload: {},
      status: 'pending' as WorkflowNodeStatus,
      agentId: null,
      adapterId: null,
      failure: null
    };

    if (event.type === 'TASK_STARTED') {
      current.sequenceStarted = Math.min(current.sequenceStarted, event.sequence);
      current.status = 'running';
      current.startedPayload = payload;
      current.agentId = sanitizeNullableString(payload.agentId);
      current.adapterId = sanitizeNullableString(payload.adapterId);
    }

    if (event.type === 'TASK_COMPLETED') {
      current.status = 'completed';
      current.sequenceCompleted = event.sequence;
      current.completionPayload = payload;
      current.agentId = sanitizeNullableString(payload.agentId) ?? current.agentId;
      current.adapterId = sanitizeNullableString(payload.adapterId) ?? current.adapterId;
      current.failure = null;
    }

    if (event.type === 'TASK_FAILED') {
      current.status = 'failed';
      current.sequenceCompleted = event.sequence;
      current.completionPayload = payload;
      current.agentId = sanitizeNullableString(payload.agentId) ?? current.agentId;
      current.adapterId = sanitizeNullableString(payload.adapterId) ?? current.adapterId;
      current.failure = createWorkflowFailureRecord({
        message: payload.error,
        nodeId,
        agentId: current.agentId,
        adapterId: current.adapterId,
        details: {
          eventType: event.type,
          sequence: event.sequence,
          payload
        }
      });
    }

    recordsByNodeId.set(nodeId, current);
  }

  return Array.from(recordsByNodeId.values())
    .sort((left, right) => {
      const sequenceCmp = left.sequenceStarted - right.sequenceStarted;
      if (sequenceCmp !== 0) {
        return sequenceCmp;
      }
      return left.nodeId.localeCompare(right.nodeId);
    })
    .map((record) => {
      const payload = record.status === 'running' ? record.startedPayload : record.completionPayload;
      const snapshot = payloadContextSnapshot(payload);
      const startedSnapshot = payloadContextSnapshot(record.startedPayload);
      const outputs = payloadTaskOutputs(record.completionPayload);
      const normalizedOutputs = normalizeJson(outputs) as Record<string, JsonValue>;

      return {
        runId: input.runId,
        workflowId,
        nodeId: record.nodeId,
        agentId: record.agentId,
        adapterId: record.adapterId,
        status: record.status,
        dependsOn: getDependsOn(nodeMap, record.nodeId),
        sequenceStarted: record.sequenceStarted,
        sequenceCompleted: record.sequenceCompleted,
        taskInputs: payloadTaskInputs(record.startedPayload),
        taskOutputs: normalizedOutputs,
        previousOutputs: payloadPreviousOutputs(startedSnapshot),
        contextSnapshot: snapshot,
        failure: record.failure
      };
    })
    .map((entry) => JSON.parse(canonicalJson(entry)) as WorkflowNodeRecord);
}
