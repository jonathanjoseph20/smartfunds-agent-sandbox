import type { WorkflowNodeRecord } from './node-record.ts';
import { stableUniqueStrings } from './serialization.ts';

export type WorkflowRunSummary = {
  runId: string;
  workflowId: string;
  missionId: string | null;
  teamId: string | null;
  projectId: string;
  status: string;
  nodeCount: number;
  completedNodeCount: number;
  failedNodeCount: number;
  timeoutNodeCount: number;
  activeNodeId: string | null;
  lastAgentUsed: string | null;
  totalOutputsGenerated: number;
  totalRetriesConsumed: number;
  replayable: boolean;
  hasFailure: boolean;
  recoverable: boolean;
  resumed: boolean;
  cancelled: boolean;
  safetyViolationCount: number;
  summaryLine: string;
};

function outputKeyCount(nodes: WorkflowNodeRecord[]): number {
  let total = 0;
  for (const node of nodes) {
    total += Object.keys(node.taskOutputs).length;
  }
  return total;
}

export function buildWorkflowRunSummary(input: {
  runId: string;
  workflowId: string;
  missionId: string | null;
  teamId: string | null;
  projectId: string;
  status: string;
  nodes: WorkflowNodeRecord[];
  activeNodeId: string | null;
}): WorkflowRunSummary {
  const completedNodeCount = input.nodes.filter((node) => node.status === 'completed').length;
  const failedNodeCount = input.nodes.filter((node) => node.status === 'failed').length;
  const timeoutNodeCount = input.nodes.filter((node) => node.status === 'timeout').length;
  const nodeCount = input.nodes.length;
  const lastNode = [...input.nodes].sort((left, right) => {
    const leftSeq = left.sequenceCompleted ?? left.sequenceStarted;
    const rightSeq = right.sequenceCompleted ?? right.sequenceStarted;
    const seqCmp = leftSeq - rightSeq;
    if (seqCmp !== 0) {
      return seqCmp;
    }
    return left.nodeId.localeCompare(right.nodeId);
  }).at(-1);

  const replayable = input.status === 'completed' || input.status === 'failed' || input.status === 'timeout' || input.status === 'cancelled';
  const hasFailure = failedNodeCount > 0 || timeoutNodeCount > 0;
  const recoverable = input.status === 'failed' || input.status === 'timeout';
  const resumed = input.status === 'running' && input.nodes.some((node) => node.retryCount > 0);
  const cancelled = input.status === 'cancelled';
  const totalRetriesConsumed = input.nodes.reduce((sum, node) => sum + (node.retryCount ?? 0), 0);
  const safetyViolationCount = input.nodes
    .filter((node) => node.failure?.code === 'SAFETY_LIMIT_VIOLATION')
    .length;
  const agentIds = stableUniqueStrings(input.nodes
    .map((node) => node.agentId)
    .filter((value): value is string => typeof value === 'string' && value.length > 0));
  const lastAgentUsed = lastNode?.agentId ?? (agentIds.length > 0 ? agentIds[agentIds.length - 1] : null);
  const totalOutputsGenerated = outputKeyCount(input.nodes);

  return {
    runId: input.runId,
    workflowId: input.workflowId,
    missionId: input.missionId,
    teamId: input.teamId,
    projectId: input.projectId,
    status: input.status,
    nodeCount,
    completedNodeCount,
    failedNodeCount,
    timeoutNodeCount,
    activeNodeId: input.activeNodeId,
    lastAgentUsed,
    totalOutputsGenerated,
    totalRetriesConsumed,
    replayable,
    hasFailure,
    recoverable,
    resumed,
    cancelled,
    safetyViolationCount,
    summaryLine: `run=${input.runId} status=${input.status} completed=${completedNodeCount}/${nodeCount} failed=${failedNodeCount} timeout=${timeoutNodeCount} retries=${totalRetriesConsumed}`
  };
}
