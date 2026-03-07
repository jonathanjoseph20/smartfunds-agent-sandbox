import type { ExecutionEvent } from '../journal/types.ts';
import type { WorkflowFailureRecord } from './failure-types.ts';
import type { WorkflowNodeRecord } from './node-record.ts';
import { buildWorkflowNodeRecords } from './node-record.ts';
import type { WorkflowRunRecord } from './run-record.ts';
import { canonicalJson, stableSortStrings, toPlainObject, type JsonValue } from './serialization.ts';

export type FirstInspectTarget =
  | { targetType: 'node'; nodeId: string }
  | { targetType: 'run'; runId: string };

export type WorkflowNodeDiagnostic = {
  runId: string;
  workflowId: string;
  nodeId: string;
  nodeDefinition: {
    id: string;
    dependsOn: string[];
  };
  dependsOn: string[];
  agentId: string | null;
  adapterId: string | null;
  status: string;
  taskInputs: Record<string, JsonValue>;
  previousOutputs: Record<string, JsonValue>;
  taskOutputs: Record<string, JsonValue>;
  contextDiff: {
    addedKeys: string[];
    updatedKeys: string[];
    removedKeys: string[];
    outputKeyCount: number;
  };
  failure: WorkflowFailureRecord | null;
  sequenceStarted: number;
  sequenceCompleted: number | null;
};

export type WorkflowRunDiagnostic = {
  runId: string;
  workflowId: string;
  status: string;
  completedNodeIds: string[];
  failedNodeIds: string[];
  timedOutNodeIds: string[];
  activeNodeId: string | null;
  outputsByNode: Record<string, Record<string, JsonValue>>;
  finalContextKeys: string[];
  firstFailedNodeId: string | null;
  lastSuccessfulNodeId: string | null;
  replayable: boolean;
  hasFailure: boolean;
  recoverable: boolean;
  resumed: boolean;
  cancelled: boolean;
  safetyViolationNodeIds: string[];
  firstInspectTarget: FirstInspectTarget;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function latestContextSnapshot(events: ExecutionEvent[]): Record<string, unknown> {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const payload = ordered[index].payload;
    if (!isRecord(payload) || !isRecord(payload.context_snapshot)) {
      continue;
    }
    return payload.context_snapshot;
  }
  return { memory: {} };
}

function priorContextForNode(node: WorkflowNodeRecord): Record<string, JsonValue> {
  if (Object.keys(node.previousOutputs).length > 0) {
    return node.previousOutputs;
  }
  return {};
}

export function summarizeContextChanges(input: {
  previous: Record<string, JsonValue>;
  next: Record<string, JsonValue>;
  outputKeyCount: number;
}): {
  addedKeys: string[];
  updatedKeys: string[];
  removedKeys: string[];
  outputKeyCount: number;
} {
  const previousKeys = new Set(Object.keys(input.previous));
  const nextKeys = new Set(Object.keys(input.next));

  const addedKeys: string[] = [];
  const updatedKeys: string[] = [];
  const removedKeys: string[] = [];

  for (const key of nextKeys) {
    if (!previousKeys.has(key)) {
      addedKeys.push(key);
      continue;
    }

    const previousValue = canonicalJson(input.previous[key]);
    const nextValue = canonicalJson(input.next[key]);
    if (previousValue !== nextValue) {
      updatedKeys.push(key);
    }
  }

  for (const key of previousKeys) {
    if (!nextKeys.has(key)) {
      removedKeys.push(key);
    }
  }

  return {
    addedKeys: stableSortStrings(addedKeys),
    updatedKeys: stableSortStrings(updatedKeys),
    removedKeys: stableSortStrings(removedKeys),
    outputKeyCount: input.outputKeyCount
  };
}

export function extractWorkflowFailures(nodes: WorkflowNodeRecord[]): WorkflowFailureRecord[] {
  return nodes
    .filter((node): node is WorkflowNodeRecord & { failure: WorkflowFailureRecord } => node.failure !== null)
    .sort((left, right) => {
      const sequenceCmp = left.sequenceStarted - right.sequenceStarted;
      if (sequenceCmp !== 0) {
        return sequenceCmp;
      }
      return left.nodeId.localeCompare(right.nodeId);
    })
    .map((node) => node.failure);
}

export function getNodeDiagnosticReport(input: {
  runId: string;
  workflowId: string;
  nodeId: string;
  nodes: WorkflowNodeRecord[];
}): WorkflowNodeDiagnostic {
  const node = input.nodes.find((entry) => entry.nodeId === input.nodeId);
  if (!node) {
    throw new Error(`NODE_NOT_FOUND: ${input.nodeId}`);
  }

  const previous = priorContextForNode(node);
  const next = toPlainObject(node.contextSnapshot.memory);

  return {
    runId: input.runId,
    workflowId: input.workflowId,
    nodeId: node.nodeId,
    nodeDefinition: {
      id: node.nodeId,
      dependsOn: node.dependsOn
    },
    dependsOn: node.dependsOn,
    agentId: node.agentId,
    adapterId: node.adapterId,
    status: node.status,
    taskInputs: node.taskInputs,
    previousOutputs: node.previousOutputs,
    taskOutputs: node.taskOutputs,
    contextDiff: summarizeContextChanges({
      previous,
      next,
      outputKeyCount: Object.keys(node.taskOutputs).length
    }),
    failure: node.failure,
    sequenceStarted: node.sequenceStarted,
    sequenceCompleted: node.sequenceCompleted
  };
}

export function firstInspectTarget(input: {
  runId: string;
  status: string;
  nodes: WorkflowNodeRecord[];
  activeNodeId: string | null;
}): FirstInspectTarget {
  const firstFailed = input.nodes
    .filter((node) => node.status === 'failed' || node.status === 'timeout')
    .sort((left, right) => {
      const seqCmp = left.sequenceStarted - right.sequenceStarted;
      if (seqCmp !== 0) {
        return seqCmp;
      }
      return left.nodeId.localeCompare(right.nodeId);
    })
    .at(0);

  if (firstFailed) {
    return { targetType: 'node', nodeId: firstFailed.nodeId };
  }

  if (input.activeNodeId) {
    return { targetType: 'node', nodeId: input.activeNodeId };
  }

  if (input.status === 'completed') {
    const lastNode = [...input.nodes].sort((left, right) => {
      const leftSequence = left.sequenceCompleted ?? left.sequenceStarted;
      const rightSequence = right.sequenceCompleted ?? right.sequenceStarted;
      const seqCmp = leftSequence - rightSequence;
      if (seqCmp !== 0) {
        return seqCmp;
      }
      return left.nodeId.localeCompare(right.nodeId);
    }).at(-1);

    if (lastNode) {
      return { targetType: 'node', nodeId: lastNode.nodeId };
    }
  }

  return { targetType: 'run', runId: input.runId };
}

export function getRunDiagnosticReport(input: {
  run: WorkflowRunRecord;
  events: ExecutionEvent[];
  nodes?: WorkflowNodeRecord[];
}): WorkflowRunDiagnostic {
  const nodes = input.nodes ?? buildWorkflowNodeRecords({
    runId: input.run.runId,
    workflowId: input.run.workflowId,
    events: input.events
  });

  const completedNodes = nodes
    .filter((node) => node.status === 'completed')
    .map((node) => node.nodeId)
    .sort((left, right) => left.localeCompare(right));
  const failedNodes = nodes
    .filter((node) => node.status === 'failed' || node.status === 'timeout')
    .map((node) => node.nodeId)
    .sort((left, right) => left.localeCompare(right));
  const timedOutNodes = nodes
    .filter((node) => node.status === 'timeout')
    .map((node) => node.nodeId)
    .sort((left, right) => left.localeCompare(right));

  const finalSnapshot = latestContextSnapshot(input.events);
  const memory = isRecord(finalSnapshot.memory) ? finalSnapshot.memory : {};

  const lastSuccessfulNode = [...nodes]
    .filter((node) => node.status === 'completed')
    .sort((left, right) => {
      const leftSequence = left.sequenceCompleted ?? left.sequenceStarted;
      const rightSequence = right.sequenceCompleted ?? right.sequenceStarted;
      const seqCmp = leftSequence - rightSequence;
      if (seqCmp !== 0) {
        return seqCmp;
      }
      return left.nodeId.localeCompare(right.nodeId);
    })
    .at(-1);

  const safetyViolationNodeIds = nodes
    .filter((node) => node.failure?.code === 'SAFETY_LIMIT_VIOLATION')
    .map((node) => node.nodeId)
    .sort((left, right) => left.localeCompare(right));

  return {
    runId: input.run.runId,
    workflowId: input.run.workflowId,
    status: input.run.status,
    completedNodeIds: completedNodes,
    failedNodeIds: failedNodes,
    timedOutNodeIds: timedOutNodes,
    activeNodeId: input.run.activeNodeId,
    outputsByNode: Object.fromEntries(nodes.map((node) => [node.nodeId, node.taskOutputs])),
    finalContextKeys: Object.keys(memory).sort((left, right) => left.localeCompare(right)),
    firstFailedNodeId: failedNodes.at(0) ?? null,
    lastSuccessfulNodeId: lastSuccessfulNode?.nodeId ?? null,
    replayable: input.run.summary.replayable,
    hasFailure: input.run.summary.hasFailure,
    recoverable: input.run.summary.recoverable,
    resumed: input.run.summary.resumed,
    cancelled: input.run.summary.cancelled,
    safetyViolationNodeIds,
    firstInspectTarget: firstInspectTarget({
      runId: input.run.runId,
      status: input.run.status,
      nodes,
      activeNodeId: input.run.activeNodeId
    })
  };
}
