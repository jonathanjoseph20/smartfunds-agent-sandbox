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
  activeNodeId: string | null;
  lastAgentUsed: string | null;
  totalOutputsGenerated: number;
  replayable: boolean;
  hasFailure: boolean;
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

  const replayable = input.status === 'completed' || input.status === 'failed';
  const hasFailure = failedNodeCount > 0;
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
    activeNodeId: input.activeNodeId,
    lastAgentUsed,
    totalOutputsGenerated,
    replayable,
    hasFailure,
    summaryLine: `run=${input.runId} status=${input.status} completed=${completedNodeCount}/${nodeCount} failed=${failedNodeCount}`
  };
}
