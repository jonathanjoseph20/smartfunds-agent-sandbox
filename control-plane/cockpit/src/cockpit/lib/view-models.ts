// View Models: map deterministic service data into UI-specific shapes.
import type { Mission, WorkflowRun, WorkflowNode, TraceEvent, FailureDetails, AgentProfile, MissionParameter, MissionStatus, RunStatus, NodeStatus } from './types';
import * as adapters from './adapters';
import { sortMissions, sortRuns } from './sorts';
import { formatTimestamp, formatDuration } from './formatters';

// --- View Model Types ---

export interface MissionListItemViewModel {
  missionId: string;
  status: MissionStatus;
  teamId: string;
  workflowId: string;
  latestRunId: string | null;
  latestRunStatus: RunStatus | null;
  startedAt: string | null;
  completedAt: string | null;
  parameterSummary: string;
}

export interface MissionDetailViewModel {
  missionId: string;
  status: MissionStatus;
  teamId: string;
  workflowId: string;
  parameters: MissionParameter[];
  runs: RunListItemViewModel[];
  agents: AgentProfile[];
  startedAt: string | null;
  completedAt: string | null;
  cliInspectCommand: string;
  cliAgentsCommand: string;
  cliCancelCommand: string;
}

export interface RunListItemViewModel {
  runId: string;
  missionId: string;
  workflowId: string;
  status: RunStatus;
  activeNodeLabel: string | null;
  failedNodeLabel: string | null;
  completedNodeCount: number;
  totalNodeCount: number;
  retryCount: number;
  recoveryState: string | null;
  cancellationFlag: boolean;
  startedAt: string;
  duration: string | null;
}

export interface RunDetailViewModel {
  runId: string;
  missionId: string;
  workflowId: string;
  teamId: string;
  status: RunStatus;
  activeNodeId: string | null;
  failedNodeId: string | null;
  completedNodeCount: number;
  totalNodeCount: number;
  retryCount: number;
  recoveryState: string | null;
  cancellationFlag: boolean;
  startedAt: string;
  completedAt: string | null;
  duration: string | null;
  nodes: NodeDetailViewModel[];
  traceEvents: TraceEventViewModel[];
  failure: FailurePanelViewModel | null;
  cliRetryCommand: string;
  cliResumeCommand: string;
  cliCancelCommand: string;
}

export interface NodeDetailViewModel {
  nodeId: string;
  label: string;
  status: NodeStatus;
  dependsOn: string[];
  agentId: string;
  agentRole: string | null;
  adapterId: string;
  inputs: Record<string, unknown>;
  previousOutputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  retryCount: number;
  maxRetries: number;
  timeoutState: string;
  recoveryState: string;
  hasFailure: boolean;
}

export interface TraceEventViewModel {
  timestamp: string;
  formattedTime: string;
  eventType: string;
  nodeId: string | null;
  agentId: string | null;
  detail: string;
  sequence: number;
}

export interface FailurePanelViewModel {
  code: string;
  message: string;
  nodeId: string;
  nodeLabel: string;
  agentId: string;
  adapterId: string;
  retryExhausted: boolean;
  timeoutClassification: string | null;
  safetyViolation: boolean;
  recoverySummary: string | null;
  suggestedAction: string;
  cliCommand: string;
  slackCommand: string;
}

export interface WorkflowDagViewModel {
  workflowId: string;
  label: string;
  nodes: NodeDetailViewModel[];
}

export interface OverviewViewModel {
  activeMissions: number;
  activeRuns: number;
  failedRuns: number;
  totalMissions: number;
  recentFailures: { runId: string; missionId: string; failedNode: string; timestamp: string }[];
}

// --- Mappers ---

function mapNodeToViewModel(node: WorkflowNode, agents: AgentProfile[]): NodeDetailViewModel {
  const agent = agents.find(a => a.agentId === node.agentId);
  return {
    nodeId: node.nodeId,
    label: node.label,
    status: node.status,
    dependsOn: node.dependsOn,
    agentId: node.agentId,
    agentRole: agent?.role ?? null,
    adapterId: node.adapterId,
    inputs: node.inputs,
    previousOutputs: node.previousOutputs,
    outputs: node.outputs,
    retryCount: node.retryCount,
    maxRetries: node.maxRetries,
    timeoutState: node.timeoutState ?? 'none',
    recoveryState: node.recoveryState ?? 'none',
    hasFailure: !!node.failureDetails,
  };
}

function mapFailure(node: WorkflowNode): FailurePanelViewModel | null {
  if (!node.failureDetails) return null;
  const f = node.failureDetails;
  return {
    code: f.code,
    message: f.message,
    nodeId: f.nodeId,
    nodeLabel: node.label,
    agentId: f.agentId,
    adapterId: f.adapterId,
    retryExhausted: f.retryExhausted,
    timeoutClassification: f.timeoutClassification ?? null,
    safetyViolation: f.safetyViolation ?? false,
    recoverySummary: f.recoverySummary ?? null,
    suggestedAction: f.suggestedAction,
    cliCommand: f.cliCommand,
    slackCommand: f.slackCommand,
  };
}

export async function getMissionList(): Promise<MissionListItemViewModel[]> {
  const allMissions = await adapters.fetchMissions();
  const allRuns = await adapters.fetchRuns();
  const sorted = sortMissions(allMissions);

  return sorted.map(m => {
    const missionRuns = allRuns.filter(r => r.missionId === m.missionId);
    const latestRun = missionRuns[missionRuns.length - 1] ?? null;
    const paramSummary = m.parameters.map(p => `--${p.key} ${p.value}`).join(' ');
    return {
      missionId: m.missionId,
      status: m.status,
      teamId: m.teamId,
      workflowId: m.workflowId,
      latestRunId: latestRun?.runId ?? null,
      latestRunStatus: latestRun?.status ?? null,
      startedAt: m.startedAt ? formatTimestamp(m.startedAt) : null,
      completedAt: m.completedAt ? formatTimestamp(m.completedAt) : null,
      parameterSummary: paramSummary,
    };
  });
}

export async function getMissionDetail(missionId: string): Promise<MissionDetailViewModel | null> {
  const mission = await adapters.fetchMission(missionId);
  if (!mission) return null;
  const roster = await adapters.fetchTeamRoster(mission.teamId);
  const missionRuns = await adapters.fetchRunsForMission(missionId);

  return {
    missionId: mission.missionId,
    status: mission.status,
    teamId: mission.teamId,
    workflowId: mission.workflowId,
    parameters: mission.parameters,
    runs: missionRuns.map(r => mapRunToListItem(r)),
    agents: roster?.agents ?? [],
    startedAt: mission.startedAt ? formatTimestamp(mission.startedAt) : null,
    completedAt: mission.completedAt ? formatTimestamp(mission.completedAt) : null,
    cliInspectCommand: `mission:inspect ${missionId}`,
    cliAgentsCommand: `mission:agents ${missionId}`,
    cliCancelCommand: `mission:cancel ${missionId}`,
  };
}

function mapRunToListItem(r: WorkflowRun): RunListItemViewModel {
  const activeNode = r.nodes.find(n => n.nodeId === r.activeNodeId);
  const failedNode = r.nodes.find(n => n.nodeId === r.failedNodeId);
  return {
    runId: r.runId,
    missionId: r.missionId,
    workflowId: r.workflowId,
    status: r.status,
    activeNodeLabel: activeNode?.label ?? null,
    failedNodeLabel: failedNode?.label ?? null,
    completedNodeCount: r.completedNodeCount,
    totalNodeCount: r.totalNodeCount,
    retryCount: r.retryCount,
    recoveryState: r.recoveryState ?? null,
    cancellationFlag: r.cancellationFlag,
    startedAt: formatTimestamp(r.startedAt),
    duration: r.completedAt ? formatDuration(r.startedAt, r.completedAt) : null,
  };
}

export async function getRunList(): Promise<RunListItemViewModel[]> {
  const allRuns = await adapters.fetchRuns();
  return sortRuns(allRuns).map(mapRunToListItem);
}

export async function getRunDetail(runId: string): Promise<RunDetailViewModel | null> {
  const run = await adapters.fetchRun(runId);
  if (!run) return null;
  const roster = await adapters.fetchTeamRoster(run.teamId);
  const agents = roster?.agents ?? [];
  const traces = await adapters.fetchTraceEvents(runId);
  const failedNode = run.nodes.find(n => n.failureDetails);

  return {
    runId: run.runId,
    missionId: run.missionId,
    workflowId: run.workflowId,
    teamId: run.teamId,
    status: run.status,
    activeNodeId: run.activeNodeId ?? null,
    failedNodeId: run.failedNodeId ?? null,
    completedNodeCount: run.completedNodeCount,
    totalNodeCount: run.totalNodeCount,
    retryCount: run.retryCount,
    recoveryState: run.recoveryState ?? null,
    cancellationFlag: run.cancellationFlag,
    startedAt: formatTimestamp(run.startedAt),
    completedAt: run.completedAt ? formatTimestamp(run.completedAt) : null,
    duration: run.completedAt ? formatDuration(run.startedAt, run.completedAt) : null,
    nodes: run.nodes.map(n => mapNodeToViewModel(n, agents)),
    traceEvents: traces.map(t => ({
      timestamp: t.timestamp,
      formattedTime: formatTimestamp(t.timestamp),
      eventType: t.eventType,
      nodeId: t.nodeId ?? null,
      agentId: t.agentId ?? null,
      detail: t.detail,
      sequence: t.sequence,
    })),
    failure: failedNode ? mapFailure(failedNode) : null,
    cliRetryCommand: `workflow:retry --run ${runId}`,
    cliResumeCommand: `workflow:resume --run ${runId}`,
    cliCancelCommand: `mission:cancel ${run.missionId}`,
  };
}

export async function getWorkflowDag(workflowId: string, runId?: string): Promise<WorkflowDagViewModel | null> {
  // If a runId is provided, use run nodes (with execution state). Otherwise use definition.
  if (runId) {
    const run = await adapters.fetchRun(runId);
    if (!run || run.workflowId !== workflowId) return null;
    const roster = await adapters.fetchTeamRoster(run.teamId);
    const agents = roster?.agents ?? [];
    const def = await adapters.fetchWorkflowDefinition(workflowId);
    return {
      workflowId,
      label: def?.label ?? workflowId,
      nodes: run.nodes.map(n => mapNodeToViewModel(n, agents)),
    };
  }
  const def = await adapters.fetchWorkflowDefinition(workflowId);
  if (!def) return null;
  return {
    workflowId,
    label: def.label,
    nodes: def.nodes.map(n => mapNodeToViewModel(n, [])),
  };
}

export async function getOverview(): Promise<OverviewViewModel> {
  const allMissions = await adapters.fetchMissions();
  const allRuns = await adapters.fetchRuns();
  const failedRuns = allRuns.filter(r => r.status === 'failed');

  return {
    activeMissions: allMissions.filter(m => m.status === 'running' || m.status === 'created').length,
    activeRuns: allRuns.filter(r => r.status === 'running').length,
    failedRuns: failedRuns.length,
    totalMissions: allMissions.length,
    recentFailures: failedRuns.map(r => {
      const failedNode = r.nodes.find(n => n.nodeId === r.failedNodeId);
      return {
        runId: r.runId,
        missionId: r.missionId,
        failedNode: failedNode?.label ?? r.failedNodeId ?? 'unknown',
        timestamp: r.completedAt ? formatTimestamp(r.completedAt) : formatTimestamp(r.startedAt),
      };
    }),
  };
}
