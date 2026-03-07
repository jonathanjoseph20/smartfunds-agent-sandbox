// Adapters: isolate the UI from raw service output.
// For Sprint 73, these consume deterministic mock data.
// TODO: Wire to real operator services via command-router when available.

import type { CommandEnvelope, Mission, WorkflowRun, TraceEvent, TeamRoster, WorkflowDefinition } from './types';
import { missions, runs, traceEvents, teamRosters, workflowDefinitions } from './mock-data';

/** Parse a command envelope and extract payload. Handles missing/malformed data gracefully. */
export function parseEnvelope<T>(envelope: CommandEnvelope<T>): T | null {
  if (!envelope || !envelope.success || envelope.payload == null) return null;
  return envelope.payload;
}

/** Fetch all missions. Returns stable-sorted list. */
export function fetchMissions(): Mission[] {
  return [...missions];
}

/** Fetch a single mission by ID. */
export function fetchMission(missionId: string): Mission | null {
  return missions.find(m => m.missionId === missionId) ?? null;
}

/** Fetch all runs. Returns stable list. */
export function fetchRuns(): WorkflowRun[] {
  return [...runs];
}

/** Fetch a single run by ID. */
export function fetchRun(runId: string): WorkflowRun | null {
  return runs.find(r => r.runId === runId) ?? null;
}

/** Fetch runs for a given mission. */
export function fetchRunsForMission(missionId: string): WorkflowRun[] {
  return runs.filter(r => r.missionId === missionId);
}

/** Fetch trace events for a run. Returns sequence-sorted list. */
export function fetchTraceEvents(runId: string): TraceEvent[] {
  const events = traceEvents[runId] ?? [];
  return [...events].sort((a, b) => a.sequence - b.sequence);
}

/** Fetch team roster by teamId. */
export function fetchTeamRoster(teamId: string): TeamRoster | null {
  return teamRosters.find(t => t.teamId === teamId) ?? null;
}

/** Fetch workflow definition by workflowId. */
export function fetchWorkflowDefinition(workflowId: string): WorkflowDefinition | null {
  return workflowDefinitions.find(w => w.workflowId === workflowId) ?? null;
}
