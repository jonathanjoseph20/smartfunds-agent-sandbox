import type { CommandEnvelope, Mission, WorkflowRun, TraceEvent, TeamRoster, WorkflowDefinition } from './types';
import { missions, runs, traceEvents, teamRosters, workflowDefinitions } from './mock-data';

const DEFAULT_RUNTIME_BASE_URL = 'http://127.0.0.1:3100';

function runtimeBaseUrl(): string {
  const fromEnv = import.meta.env.VITE_RUNTIME_API_BASE_URL;
  if (typeof fromEnv === 'string' && fromEnv.trim().length > 0) {
    return fromEnv.replace(/\/$/, '');
  }
  return DEFAULT_RUNTIME_BASE_URL;
}

async function request<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${runtimeBaseUrl()}${path}`, {
      method: 'GET',
      headers: {
        'content-type': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const body = await response.json() as {
      success?: boolean;
      payload?: T;
    };

    if (body.success !== true) {
      return null;
    }

    return body.payload ?? null;
  } catch {
    return null;
  }
}

export function parseEnvelope<T>(envelope: CommandEnvelope<T>): T | null {
  if (!envelope || !envelope.success || envelope.payload == null) return null;
  return envelope.payload;
}

function fromMissionRows(rows: Array<Record<string, unknown>>): Mission[] {
  return rows.map((row) => ({
    missionId: String(row.missionId ?? ''),
    status: (row.status as Mission['status']) ?? 'created',
    teamId: String(row.teamId ?? ''),
    workflowId: String(row.workflowId ?? ''),
    parameters: [],
    workflowRuns: typeof row.workflowRun === 'string' ? [row.workflowRun] : []
  }));
}

function fromRunRows(rows: Array<Record<string, unknown>>): WorkflowRun[] {
  return rows.map((row) => ({
    runId: String(row.runId ?? ''),
    missionId: String(row.missionId ?? ''),
    workflowId: String(row.workflowId ?? ''),
    status: (row.status as WorkflowRun['status']) ?? 'created',
    nodes: [],
    completedNodeCount: Number(row.completedNodeCount ?? 0),
    totalNodeCount: Number(row.completedNodeCount ?? 0) + Number(row.failedNodeCount ?? 0) + Number(row.timeoutNodeCount ?? 0),
    retryCount: Number(row.retryCount ?? 0),
    cancellationFlag: false,
    startedAt: new Date().toISOString(),
    teamId: 'unknown'
  }));
}

export async function fetchMissions(): Promise<Mission[]> {
  const payload = await request<Array<Record<string, unknown>>>('/missions');
  if (!payload) {
    return [...missions];
  }
  return fromMissionRows(payload);
}

export async function fetchMission(missionId: string): Promise<Mission | null> {
  const payload = await request<Record<string, unknown>>(`/missions/${missionId}`);
  if (!payload) {
    return missions.find((m) => m.missionId === missionId) ?? null;
  }

  return {
    missionId: String(payload.missionId ?? missionId),
    status: (payload.status as Mission['status']) ?? 'created',
    teamId: String(payload.teamId ?? ''),
    workflowId: String(payload.workflowId ?? ''),
    parameters: [],
    workflowRuns: Array.isArray(payload.workflowRuns)
      ? payload.workflowRuns.map((entry) => String((entry as { runId?: string }).runId ?? ''))
      : []
  };
}

export async function fetchRuns(): Promise<WorkflowRun[]> {
  const payload = await request<Array<Record<string, unknown>>>('/runs');
  if (!payload) {
    return [...runs];
  }
  return fromRunRows(payload);
}

export async function fetchRun(runId: string): Promise<WorkflowRun | null> {
  const payload = await request<Record<string, unknown>>(`/runs/${runId}`);
  if (!payload) {
    return runs.find((r) => r.runId === runId) ?? null;
  }

  const nodeStates = Array.isArray(payload.nodeStates) ? payload.nodeStates : [];
  const nodes = nodeStates.map((node) => ({
    nodeId: String((node as { nodeId?: string }).nodeId ?? ''),
    label: String((node as { nodeId?: string }).nodeId ?? ''),
    status: ((node as { status?: WorkflowRun['nodes'][number]['status'] }).status ?? 'pending'),
    dependsOn: [],
    agentId: String((node as { agentId?: string }).agentId ?? 'unknown'),
    adapterId: String((node as { adapterId?: string }).adapterId ?? 'unknown'),
    inputs: {},
    previousOutputs: {},
    outputs: {},
    retryCount: Number((node as { retryCount?: number }).retryCount ?? 0),
    maxRetries: 3
  }));

  return {
    runId: String(payload.runId ?? runId),
    missionId: String(payload.missionId ?? ''),
    workflowId: String(payload.workflowId ?? ''),
    status: (payload.status as WorkflowRun['status']) ?? 'created',
    nodes,
    activeNodeId: typeof payload.activeNodeId === 'string' ? payload.activeNodeId : undefined,
    completedNodeCount: Number(nodes.filter((node) => node.status === 'completed').length),
    totalNodeCount: nodes.length,
    retryCount: 0,
    cancellationFlag: false,
    startedAt: new Date().toISOString(),
    teamId: 'unknown'
  };
}

export async function fetchRunsForMission(missionId: string): Promise<WorkflowRun[]> {
  const allRuns = await fetchRuns();
  return allRuns.filter((r) => r.missionId === missionId);
}

export async function fetchTraceEvents(runId: string): Promise<TraceEvent[]> {
  const payload = await request<Record<string, unknown>>(`/runs/${runId}/trace`);
  if (!payload || !Array.isArray(payload.trace)) {
    const events = traceEvents[runId] ?? [];
    return [...events].sort((a, b) => a.sequence - b.sequence);
  }

  return payload.trace.map((entry, index) => ({
    timestamp: new Date().toISOString(),
    eventType: 'node_entered',
    detail: JSON.stringify(entry),
    sequence: index + 1
  })) as TraceEvent[];
}

export async function fetchTeamRoster(teamId: string): Promise<TeamRoster | null> {
  const payload = await request<Record<string, unknown>>(`/teams/${teamId}`);
  if (!payload) {
    return teamRosters.find((t) => t.teamId === teamId) ?? null;
  }

  const agents = Array.isArray(payload.agents) ? payload.agents : [];
  return {
    teamId: String(payload.teamId ?? teamId),
    agents: agents.map((entry) => ({
      agentId: String((entry as { agentId?: string }).agentId ?? ''),
      role: String((entry as { role?: string }).role ?? ''),
      profile: String((entry as { profile?: string }).profile ?? '')
    }))
  };
}

export async function fetchWorkflowDefinition(workflowId: string): Promise<WorkflowDefinition | null> {
  const payload = await request<Record<string, unknown>>(`/workflows/${workflowId}`);
  if (!payload) {
    return workflowDefinitions.find((w) => w.workflowId === workflowId) ?? null;
  }

  const nodes = Array.isArray(payload.nodes) ? payload.nodes : [];
  return {
    workflowId,
    label: workflowId,
    nodes: nodes.map((entry) => ({
      nodeId: String((entry as { id?: string }).id ?? ''),
      label: String((entry as { task?: string }).task ?? ''),
      status: 'pending',
      dependsOn: Array.isArray((entry as { dependsOn?: unknown[] }).dependsOn)
        ? ((entry as { dependsOn: unknown[] }).dependsOn.map((dep) => String(dep)))
        : [],
      agentId: String((entry as { agent?: string }).agent ?? 'unknown'),
      adapterId: String((entry as { task?: string }).task ?? 'unknown'),
      inputs: {},
      previousOutputs: {},
      outputs: {},
      retryCount: 0,
      maxRetries: 3
    }))
  };
}
