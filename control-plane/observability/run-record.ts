import type { ExecutionEvent, ExecutionRun } from '../journal/types.ts';
import type { WorkflowNodeRecord } from './node-record.ts';
import { buildWorkflowNodeRecords } from './node-record.ts';
import { buildWorkflowRunSummary, type WorkflowRunSummary } from './summary-builder.ts';
import { sanitizeNullableString, stableUniqueStrings } from './serialization.ts';

export type WorkflowRunRecord = {
  runId: string;
  workflowId: string;
  missionId: string | null;
  teamId: string | null;
  profile: string | null;
  executionPath: 'governed' | 'lite' | null;
  projectId: string;
  status: string;
  nodeCount: number;
  completedNodeCount: number;
  failedNodeCount: number;
  timeoutNodeCount: number;
  retryCount: number;
  startSequence: number;
  endSequence: number | null;
  activeNodeId: string | null;
  agentRoster: string[];
  summary: WorkflowRunSummary;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function extractMetadata(events: ExecutionEvent[]): {
  workflowId: string;
  missionId: string | null;
  teamId: string | null;
  agentRoster: string[];
} {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);

  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    const payload = ordered[index].payload;
    if (!isRecord(payload) || !isRecord(payload.context_snapshot)) {
      continue;
    }

    const snapshot = payload.context_snapshot;
    const metadata = isRecord(snapshot.metadata) ? snapshot.metadata : {};
    const roster = Array.isArray(metadata.agentRoster)
      ? metadata.agentRoster.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : [];

    return {
      workflowId: sanitizeNullableString(metadata.workflowId) ?? 'unknown-workflow',
      missionId: sanitizeNullableString(snapshot.missionId) ?? sanitizeNullableString(metadata.missionId),
      teamId: sanitizeNullableString(snapshot.teamId) ?? sanitizeNullableString(metadata.teamId),
      agentRoster: stableUniqueStrings(roster)
    };
  }

  return {
    workflowId: 'unknown-workflow',
    missionId: null,
    teamId: null,
    agentRoster: []
  };
}

function deriveStatus(run: ExecutionRun, events: ExecutionEvent[]): string {
  const ordered = [...events].sort((left, right) => left.sequence - right.sequence);
  const last = ordered.at(-1);
  if (!last) {
    return run.status;
  }
  if (last.type === 'RUN_COMPLETED') {
    return 'completed';
  }
  if (last.type === 'RUN_FAILED') {
    return 'failed';
  }
  if (last.type === 'WORKFLOW_TIMEOUT') {
    return 'timeout';
  }
  if (last.type === 'WORKFLOW_CANCELLED') {
    return 'cancelled';
  }
  if (ordered.length > 0) {
    return 'running';
  }
  return run.status;
}

function deriveActiveNodeId(nodes: WorkflowNodeRecord[]): string | null {
  const active = nodes
    .filter((node) => node.status === 'running')
    .sort((left, right) => {
      const sequenceCmp = left.sequenceStarted - right.sequenceStarted;
      if (sequenceCmp !== 0) {
        return sequenceCmp;
      }
      return left.nodeId.localeCompare(right.nodeId);
    })
    .at(-1);

  return active?.nodeId ?? null;
}

export function buildWorkflowRunRecord(input: {
  run: ExecutionRun;
  events: ExecutionEvent[];
}): WorkflowRunRecord {
  const orderedEvents = [...input.events].sort((left, right) => left.sequence - right.sequence);
  const metadata = extractMetadata(orderedEvents);
  const nodes = buildWorkflowNodeRecords({
    runId: input.run.runId,
    events: orderedEvents,
    workflowId: metadata.workflowId
  });
  const status = deriveStatus(input.run, orderedEvents);
  const activeNodeId = deriveActiveNodeId(nodes);
  const startSequence = orderedEvents.length > 0 ? orderedEvents[0].sequence : 0;
  const endSequence = status === 'completed' || status === 'failed'
    || status === 'timeout'
    || status === 'cancelled'
    ? (orderedEvents.length > 0 ? orderedEvents[orderedEvents.length - 1].sequence : null)
    : null;

  const nodeAgentRoster = nodes
    .map((node) => node.agentId)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  const agentRoster = stableUniqueStrings([...metadata.agentRoster, ...nodeAgentRoster]);

  const summary = buildWorkflowRunSummary({
    runId: input.run.runId,
    workflowId: metadata.workflowId,
    missionId: metadata.missionId,
    teamId: metadata.teamId,
    projectId: input.run.projectId,
    status,
    nodes,
    activeNodeId
  });

  return {
    runId: input.run.runId,
    workflowId: metadata.workflowId,
    missionId: metadata.missionId,
    teamId: metadata.teamId,
    profile: typeof input.run.profile === 'string' ? input.run.profile : null,
    executionPath: input.run.executionPath ?? null,
    projectId: input.run.projectId,
    status,
    nodeCount: nodes.length,
    completedNodeCount: nodes.filter((node) => node.status === 'completed').length,
    failedNodeCount: nodes.filter((node) => node.status === 'failed').length,
    timeoutNodeCount: nodes.filter((node) => node.status === 'timeout').length,
    retryCount: nodes.reduce((sum, node) => sum + (node.retryCount ?? 0), 0),
    startSequence,
    endSequence,
    activeNodeId,
    agentRoster,
    summary
  };
}

export function buildWorkflowRunRecords(input: {
  runs: ExecutionRun[];
  inspectRun: (runId: string) => { run: ExecutionRun; events: ExecutionEvent[] };
}): WorkflowRunRecord[] {
  return [...input.runs]
    .sort((left, right) => {
      const indexCmp = left.createdIndex - right.createdIndex;
      if (indexCmp !== 0) {
        return indexCmp;
      }
      return left.runId.localeCompare(right.runId);
    })
    .map((run) => buildWorkflowRunRecord(input.inspectRun(run.runId)))
    .filter((record) => record.workflowId !== 'unknown-workflow');
}
