import { loadAgentProfilesFromDir } from '../agents/agent-profile-loader.ts';
import type { AgentProfileDefinition } from '../agents/agent-profile-types.ts';
import type { ExecutionJournal } from '../journal/journal.ts';
import { createExecutionJournal } from '../journal/journal.ts';
import { getRunDiagnosticReport } from '../observability/diagnostics.ts';
import { buildWorkflowNodeRecords } from '../observability/node-record.ts';
import { buildWorkflowRunRecord, buildWorkflowRunRecords } from '../observability/run-record.ts';
import type { MissionDefinition, MissionParameterSchema } from '../missions/mission-types.ts';
import { loadMissionDefinitionById, loadMissionDefinitionsFromDir } from '../missions/mission-loader.ts';
import { createSwarmRunner } from '../swarm/swarm-runner.ts';
import { loadTeamDefinitionById } from '../teams/team-loader.ts';
import type { TeamDefinition } from '../teams/team-types.ts';
import { loadWorkflowDefinitionById } from '../workflows/workflow-loader.ts';
import { createSwarmWorkflowExecutor } from '../workflows/workflow-runner.ts';
import { executeWorkflowRunWithHardening } from '../runtime/hardened-workflow-runtime.ts';
import { cancelWorkflowRun, reconstructWorkflowStateFromJournal } from '../runtime/recovery-engine.ts';

type MissionServiceOptions = {
  journal?: ExecutionJournal;
  rootDir?: string;
  missionsDir?: string;
  teamsDir?: string;
  agentsDir?: string;
  workflowsDir?: string;
};

function sortedObject(input: Record<string, string>): Record<string, string> {
  const entries = Object.entries(input).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(entries);
}

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function mergeMissionContext(input: {
  initialContext: Record<string, unknown>;
  missionParameters: Record<string, string>;
}): Record<string, unknown> {
  const merged: Record<string, unknown> = {
    ...input.initialContext,
    missionParameters: sortedObject(input.missionParameters)
  };

  return Object.fromEntries(Object.entries(merged).sort(([left], [right]) => left.localeCompare(right)));
}

function resolveAgentRoster(team: TeamDefinition, profiles: AgentProfileDefinition[]): string[] {
  const profileMap = new Map(profiles.map((profile) => [profile.agentId, profile]));
  const missing = team.members.filter((member) => !profileMap.has(member));
  if (missing.length > 0) {
    throw new Error(`Team ${team.teamId} references unknown agent profiles: ${sortedUnique(missing).join(', ')}.`);
  }

  return sortedUnique(team.members);
}

function validateMissionTeamCoherence(mission: MissionDefinition, team: TeamDefinition): void {
  if (mission.teamId !== team.teamId) {
    throw new Error(`Mission ${mission.missionId} references mismatched teamId ${mission.teamId}.`);
  }
  if (mission.projectId !== team.projectId) {
    throw new Error(
      `Mission ${mission.missionId} projectId ${mission.projectId} does not match team ${team.teamId} projectId ${team.projectId}.`
    );
  }
}

function resolveMissionParameters(input: {
  missionId: string;
  schema?: MissionParameterSchema;
  provided: Record<string, string>;
}): Record<string, string> {
  const schema = input.schema;
  const defaults = sortedObject((schema?.defaults ?? {}) as Record<string, string>);
  const provided = sortedObject(input.provided);
  const merged = sortedObject({ ...defaults, ...provided });

  if (schema?.allowed && schema.allowed.length > 0) {
    const allowed = new Set(schema.allowed);
    const invalid = Object.keys(merged).filter((key) => !allowed.has(key));
    if (invalid.length > 0) {
      throw new Error(`MISSION_PARAM_INVALID: ${input.missionId}: ${sortedUnique(invalid).join(', ')}`);
    }
  }

  if (schema?.required && schema.required.length > 0) {
    const missing = schema.required.filter((key) => !Object.prototype.hasOwnProperty.call(merged, key));
    if (missing.length > 0) {
      throw new Error(`MISSION_PARAM_MISSING_REQUIRED: ${input.missionId}: ${sortedUnique(missing).join(', ')}`);
    }
  }

  return merged;
}

function mapRunStatusToMissionStatus(status: string): 'created' | 'running' | 'completed' | 'failed' | 'cancelled' {
  if (status === 'completed') {
    return 'completed';
  }
  if (status === 'failed' || status === 'timeout') {
    return 'failed';
  }
  if (status === 'cancelled') {
    return 'cancelled';
  }
  if (status === 'running') {
    return 'running';
  }
  return 'created';
}

function buildJournal(options: MissionServiceOptions): ExecutionJournal {
  return options.journal ?? createExecutionJournal({ rootDir: options.rootDir });
}

export function createMissionService(options: MissionServiceOptions = {}) {
  const journal = buildJournal(options);

  async function startMission(input: { missionId: string; params: Record<string, string> }): Promise<Record<string, unknown>> {
    const profiles = loadAgentProfilesFromDir(options.agentsDir);
    const mission = loadMissionDefinitionById(input.missionId, options.missionsDir);
    const team = loadTeamDefinitionById(mission.teamId, options.teamsDir, profiles);

    validateMissionTeamCoherence(mission, team);
    const agentRoster = resolveAgentRoster(team, profiles);
    const workflow = loadWorkflowDefinitionById(mission.workflowId, options.workflowsDir);
    const missionParameters = resolveMissionParameters({
      missionId: mission.missionId,
      schema: mission.parameterSchema,
      provided: input.params
    });

    const mergedContext = mergeMissionContext({
      initialContext: mission.initialContext,
      missionParameters
    });

    const run = journal.createRun({
      projectId: mission.projectId,
      kind: 'mission',
      entrypoint: `mission:${mission.missionId}`
    });

    const swarmRunner = createSwarmRunner({ journal });
    const executor = createSwarmWorkflowExecutor({
      swarmRunner,
      projectId: mission.projectId,
      missionMemory: {
        missionParameters,
        missionContext: mergedContext
      }
    });

    await executeWorkflowRunWithHardening({
      journal,
      runId: run.runId,
      missionId: mission.missionId,
      workflow,
      executor,
      missionContextMemory: {
        missionParameters,
        missionContext: mergedContext
      }
    });

    const inspected = journal.inspectRun(run.runId);
    const runRecord = buildWorkflowRunRecord(inspected);

    return {
      missionId: mission.missionId,
      status: mapRunStatusToMissionStatus(runRecord.status),
      teamId: mission.teamId,
      workflowId: mission.workflowId,
      workflowRun: runRecord.runId,
      missionParameters,
      contextKeys: Object.keys(mergedContext).sort((left, right) => left.localeCompare(right))
    };
  }

  function listMissions(): Array<Record<string, unknown>> {
    const missions = loadMissionDefinitionsFromDir(options.missionsDir);
    const runs = journal.listRuns();
    const runRecords = buildWorkflowRunRecords({
      runs,
      inspectRun: (runId) => journal.inspectRun(runId)
    });

    const missionRows = missions.map((mission) => {
      const candidates = runRecords
        .filter((record) => record.missionId === mission.missionId)
        .sort((left, right) => left.runId.localeCompare(right.runId));

      const latest = candidates.at(-1);
      return {
        missionId: mission.missionId,
        status: latest ? mapRunStatusToMissionStatus(latest.status) : 'created',
        workflowRun: latest?.runId ?? null,
        teamId: mission.teamId,
        workflowId: mission.workflowId
      };
    });

    const adHocMissionRows = runs
      .filter((run) => run.entrypoint.startsWith('mission:'))
      .map((run) => run.entrypoint.slice('mission:'.length))
      .filter((missionId) => missionId.length > 0)
      .filter((missionId) => !missionRows.some((row) => row.missionId === missionId))
      .sort((left, right) => left.localeCompare(right))
      .map((missionId) => {
        const latest = runRecords
          .filter((record) => record.missionId === missionId)
          .sort((left, right) => left.runId.localeCompare(right.runId))
          .at(-1);

        return {
          missionId,
          status: latest ? mapRunStatusToMissionStatus(latest.status) : 'created',
          workflowRun: latest?.runId ?? null,
          teamId: null,
          workflowId: null
        };
      });

    return [...missionRows, ...adHocMissionRows]
      .sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  function inspectMission(input: { missionId: string }): Record<string, unknown> {
    const mission = loadMissionDefinitionById(input.missionId, options.missionsDir);
    const runs = journal.listRuns();
    const runRecords = buildWorkflowRunRecords({
      runs,
      inspectRun: (runId) => journal.inspectRun(runId)
    });

    const linkedRuns = runRecords
      .filter((record) => record.missionId === input.missionId)
      .sort((left, right) => left.runId.localeCompare(right.runId));

    const latest = linkedRuns.at(-1);

    if (!latest) {
      return {
        missionId: mission.missionId,
        status: 'created',
        teamId: mission.teamId,
        workflowId: mission.workflowId,
        workflowRuns: [],
        nodeStates: [],
        diagnostics: null
      };
    }

    const latestInspected = journal.inspectRun(latest.runId);
    const nodes = buildWorkflowNodeRecords({
      runId: latest.runId,
      workflowId: latest.workflowId,
      events: latestInspected.events
    });
    const diagnostics = getRunDiagnosticReport({
      run: latest,
      events: latestInspected.events,
      nodes
    });

    return {
      missionId: mission.missionId,
      status: mapRunStatusToMissionStatus(latest.status),
      teamId: mission.teamId,
      workflowId: mission.workflowId,
      workflowRuns: linkedRuns.map((record) => ({
        runId: record.runId,
        status: record.status,
        retryCount: record.retryCount,
        completedNodeCount: record.completedNodeCount,
        failedNodeCount: record.failedNodeCount,
        timeoutNodeCount: record.timeoutNodeCount
      })),
      nodeStates: nodes.map((node) => ({
        nodeId: node.nodeId,
        status: node.status,
        retryCount: node.retryCount,
        timeoutType: node.timeoutType
      })),
      diagnostics: {
        failedNodeIds: diagnostics.failedNodeIds,
        timedOutNodeIds: diagnostics.timedOutNodeIds,
        recoverable: diagnostics.recoverable,
        resumed: diagnostics.resumed,
        cancelled: diagnostics.cancelled,
        firstInspectTarget: diagnostics.firstInspectTarget,
        finalContextKeys: diagnostics.finalContextKeys
      }
    };
  }

  function cancelMission(input: { missionId: string }): Record<string, unknown> {
    const runRecords = buildWorkflowRunRecords({
      runs: journal.listRuns(),
      inspectRun: (runId) => journal.inspectRun(runId)
    }).filter((record) => record.missionId === input.missionId)
      .sort((left, right) => left.runId.localeCompare(right.runId));

    const active = [...runRecords]
      .reverse()
      .find((record) => record.status === 'created' || record.status === 'running');

    if (!active) {
      throw new Error(`MISSION_NOT_CANCELLABLE: ${input.missionId}`);
    }

    const inspected = journal.inspectRun(active.runId);
    const state = reconstructWorkflowStateFromJournal({
      runId: active.runId,
      workflowId: active.workflowId,
      events: inspected.events
    });
    const decision = cancelWorkflowRun({ state });

    if (!decision.accepted) {
      throw new Error('WORKFLOW_ALREADY_TERMINAL');
    }

    journal.appendEvent({
      runId: active.runId,
      type: 'WORKFLOW_CANCELLED',
      phase: 'implement',
      payload: {
        workflowId: active.workflowId,
        runId: active.runId
      }
    });

    return {
      missionId: input.missionId,
      runId: active.runId,
      status: 'cancelled'
    };
  }

  return {
    startMission,
    listMissions,
    inspectMission,
    cancelMission
  };
}

export type MissionService = ReturnType<typeof createMissionService>;
