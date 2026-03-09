import { loadAgentProfilesFromDir } from '../agents/agent-profile-loader.ts';
import type { AgentProfileDefinition } from '../agents/agent-profile-types.ts';
import type { ExecutionJournal } from '../journal/journal.ts';
import { createExecutionJournal } from '../journal/journal.ts';
import { getRunDiagnosticReport } from '../observability/diagnostics.ts';
import { buildWorkflowNodeRecords } from '../observability/node-record.ts';
import { buildWorkflowRunRecord, buildWorkflowRunRecords } from '../observability/run-record.ts';
import type { MissionDefinition, MissionParameterSchema } from '../missions/mission-types.ts';
import { loadMissionDefinitionById, loadMissionDefinitionsFromDir } from '../missions/mission-loader.ts';
import { assertMissionArtifacts, verifyMissionArtifacts } from '../missions/mission-artifact-verifier.ts';
import { loadMissionRegistryBundle, validateMissionTemplateAgainstRegistry } from '../missions/mission-registry-loader.ts';
import { loadMissionTemplateById, loadMissionTemplatesFromDir } from '../missions/mission-template-loader.ts';
import {
  advanceRuntimeMissionPhase,
  createRuntimeMissionInstance,
  getRuntimeMissionRecord,
  listRuntimeMissionRecords,
  setRuntimeMissionResult
} from '../missions/runtime-mission-instance.ts';
import { createSwarmRunner } from '../swarm/swarm-runner.ts';
import { loadTeamDefinitionById } from '../teams/team-loader.ts';
import type { TeamDefinition } from '../teams/team-types.ts';
import { loadWorkflowDefinitionById } from '../workflows/workflow-loader.ts';
import { createSwarmWorkflowExecutor } from '../workflows/workflow-runner.ts';
import { executeWorkflowRunWithHardening } from '../runtime/hardened-workflow-runtime.ts';
import { cancelWorkflowRun, reconstructWorkflowStateFromJournal } from '../runtime/recovery-engine.ts';
import { writeArtifact } from '../../runtime/output/artifact-writer.ts';

type MissionServiceOptions = {
  journal?: ExecutionJournal;
  rootDir?: string;
  missionsDir?: string;
  missionTemplatesDir?: string;
  runtimeMissionsDir?: string;
  missionTeamRegistryPath?: string;
  missionTeamsDir?: string;
  missionAgentsDir?: string;
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

function buildDatasetRows(input: {
  missionId: string;
  runId: string;
  workflowId: string;
  nodeStates: Array<{
    nodeId: string;
    status: string;
    agentId: string | null;
    adapterId: string | null;
    retryCount: number;
  }>;
}): Array<Record<string, unknown>> {
  return [...input.nodeStates]
    .sort((left, right) => left.nodeId.localeCompare(right.nodeId))
    .map((node) => ({
      missionId: input.missionId,
      runId: input.runId,
      workflowId: input.workflowId,
      nodeId: node.nodeId,
      status: node.status,
      task: node.adapterId ?? '',
      agentId: node.agentId ?? '',
      retryCount: node.retryCount
    }));
}

function buildLogsText(input: {
  events: Array<{
    sequence: number;
    type: string;
    taskId?: string;
    payload?: unknown;
  }>;
}): string {
  const lines = [...input.events]
    .sort((left, right) => left.sequence - right.sequence)
    .map((event) => {
      const payload = (event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload))
        ? event.payload as Record<string, unknown>
        : {};
      const failureCode = typeof payload.failureCode === 'string' ? payload.failureCode : '';
      const node = typeof event.taskId === 'string' ? event.taskId : '';
      return [String(event.sequence), event.type, node, failureCode].join('|');
    });
  return `${lines.join('\n')}\n`;
}

function writeMissionArtifacts(input: {
  missionId: string;
  runId: string;
  workflowId: string;
  status: string;
  executionOrder: string[];
  nodeStates: Array<{
    nodeId: string;
    status: string;
    agentId: string | null;
    adapterId: string | null;
    retryCount: number;
  }>;
  events: Array<{
    sequence: number;
    type: string;
    taskId?: string;
    payload?: unknown;
  }>;
}): void {
  const generatedArtifacts = ['report.md', 'dataset.csv', 'summary.json', 'logs.txt'];
  const summaryPayload = {
    generatedArtifacts,
    missionId: input.missionId,
    runId: input.runId,
    workflowId: input.workflowId,
    status: input.status,
    nodeCount: input.nodeStates.length,
    executionOrder: [...input.executionOrder].sort((left, right) => left.localeCompare(right))
  };

  const report = [
    '# Mission Report',
    '',
    `Mission ID: ${input.missionId}`,
    `Run ID: ${input.runId}`,
    `Workflow ID: ${input.workflowId}`,
    `Status: ${input.status}`,
    `Nodes: ${String(input.nodeStates.length)}`,
    '',
    'Execution Order',
    ...input.executionOrder.map((nodeId) => `- ${nodeId}`),
    '',
    'Generated Artifacts',
    ...generatedArtifacts.map((name) => `- ${name}`),
    ''
  ].join('\n');

  writeArtifact({
    missionId: input.missionId,
    runId: input.runId,
    type: 'markdown',
    filename: 'report.md',
    content: report
  });

  writeArtifact({
    missionId: input.missionId,
    runId: input.runId,
    type: 'json',
    filename: 'summary.json',
    content: summaryPayload
  });

  writeArtifact({
    missionId: input.missionId,
    runId: input.runId,
    type: 'csv',
    filename: 'dataset.csv',
    content: {
      columns: ['agentId', 'missionId', 'nodeId', 'retryCount', 'runId', 'status', 'task', 'workflowId'],
      rows: buildDatasetRows({
        missionId: input.missionId,
        runId: input.runId,
        workflowId: input.workflowId,
        nodeStates: input.nodeStates
      })
    }
  });

  writeArtifact({
    missionId: input.missionId,
    runId: input.runId,
    type: 'text',
    filename: 'logs.txt',
    content: buildLogsText({ events: input.events })
  });
}

async function executeMissionWorkflow(input: {
  journal: ExecutionJournal;
  missionId: string;
  projectId: string;
  workflowId: string;
  missionParameters: Record<string, string>;
  missionContext: Record<string, unknown>;
  workflowsDir?: string;
}): Promise<{ runId: string; status: string }> {
  const workflow = loadWorkflowDefinitionById(input.workflowId, input.workflowsDir);

  const run = input.journal.createRun({
    projectId: input.projectId,
    kind: 'mission',
    entrypoint: `mission:${input.missionId}`
  });

  const swarmRunner = createSwarmRunner({ journal: input.journal });
  const executor = createSwarmWorkflowExecutor({
    swarmRunner,
    projectId: input.projectId,
    missionMemory: {
      missionParameters: input.missionParameters,
      missionContext: input.missionContext
    }
  });

  await executeWorkflowRunWithHardening({
    journal: input.journal,
    runId: run.runId,
    missionId: input.missionId,
    workflow,
    executor,
    missionContextMemory: {
      missionParameters: input.missionParameters,
      missionContext: input.missionContext
    }
  });

  const inspected = input.journal.inspectRun(run.runId);
  const runRecord = buildWorkflowRunRecord(inspected);
  const nodeRecords = buildWorkflowNodeRecords({
    runId: runRecord.runId,
    workflowId: runRecord.workflowId,
    events: inspected.events
  });
  const nodeStates = nodeRecords.map((node) => ({
    nodeId: node.nodeId,
    status: node.status,
    agentId: node.agentId,
    adapterId: node.adapterId,
    retryCount: node.retryCount
  }));
  const executionOrder = Array.isArray(runRecord.summary.executionOrder)
    ? runRecord.summary.executionOrder
    : [...nodeRecords]
      .sort((left, right) => {
        const seqCmp = left.sequenceStarted - right.sequenceStarted;
        if (seqCmp !== 0) {
          return seqCmp;
        }
        return left.nodeId.localeCompare(right.nodeId);
      })
      .map((node) => node.nodeId);
  writeMissionArtifacts({
    missionId: input.missionId,
    runId: runRecord.runId,
    workflowId: runRecord.workflowId,
    status: runRecord.status,
    executionOrder,
    nodeStates,
    events: inspected.events.map((event) => ({
      sequence: event.sequence,
      type: event.type,
      ...(event.taskId ? { taskId: event.taskId } : {}),
      ...(event.payload ? { payload: event.payload } : {})
    }))
  });

  return {
    runId: runRecord.runId,
    status: runRecord.status
  };
}

export function createMissionService(options: MissionServiceOptions = {}) {
  const journal = buildJournal(options);

  async function startMission(input: { missionId: string; params: Record<string, string> }): Promise<Record<string, unknown>> {
    const profiles = loadAgentProfilesFromDir(options.agentsDir);
    const mission = loadMissionDefinitionById(input.missionId, options.missionsDir);
    const team = loadTeamDefinitionById(mission.teamId, options.teamsDir, profiles);

    validateMissionTeamCoherence(mission, team);
    const agentRoster = resolveAgentRoster(team, profiles);
    const missionParameters = resolveMissionParameters({
      missionId: mission.missionId,
      schema: mission.parameterSchema,
      provided: input.params
    });

    const mergedContext = mergeMissionContext({
      initialContext: mission.initialContext,
      missionParameters
    });

    const executed = await executeMissionWorkflow({
      journal,
      missionId: mission.missionId,
      projectId: mission.projectId,
      workflowId: mission.workflowId,
      missionParameters,
      missionContext: mergedContext,
      workflowsDir: options.workflowsDir
    });

    return {
      missionId: mission.missionId,
      status: mapRunStatusToMissionStatus(executed.status),
      teamId: mission.teamId,
      workflowId: mission.workflowId,
      workflowRun: executed.runId,
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

  function createMission(input: { templateId: string }): Record<string, unknown> {
    const template = loadMissionTemplateById(input.templateId, options.missionTemplatesDir);
    const registryBundle = loadMissionRegistryBundle({
      registryPath: options.missionTeamRegistryPath,
      teamsDir: options.missionTeamsDir,
      agentsDir: options.missionAgentsDir
    });
    validateMissionTemplateAgainstRegistry(template, registryBundle);

    const created = createRuntimeMissionInstance({
      template,
      rootDir: options.runtimeMissionsDir
    });

    return {
      missionId: created.missionId,
      template: created.template.missionId,
      teamId: created.template.teamId,
      status: created.status.status,
      phase: created.status.phase
    };
  }

  function listRuntimeMissions(): Array<Record<string, unknown>> {
    const templates = loadMissionTemplatesFromDir(options.missionTemplatesDir);
    return listRuntimeMissionRecords({
      templates,
      rootDir: options.runtimeMissionsDir
    }).map((record) => ({
      missionId: record.missionId,
      template: record.status.template,
      teamId: record.status.teamId,
      status: record.status.status,
      phase: record.status.phase
    }));
  }

  function missionStatus(input: { missionId: string }): Record<string, unknown> {
    const templates = loadMissionTemplatesFromDir(options.missionTemplatesDir);
    const record = getRuntimeMissionRecord({
      missionId: input.missionId,
      templates,
      rootDir: options.runtimeMissionsDir
    });

    const artifacts = verifyMissionArtifacts({
      template: record.template,
      artifactsDir: record.artifactsDir
    });

    return {
      missionId: record.missionId,
      template: record.status.template,
      teamId: record.status.teamId,
      status: record.status.status,
      phase: record.status.phase,
      artifacts
    };
  }

  async function runMission(input: { missionId: string }): Promise<Record<string, unknown>> {
    const templates = loadMissionTemplatesFromDir(options.missionTemplatesDir);
    const record = getRuntimeMissionRecord({
      missionId: input.missionId,
      templates,
      rootDir: options.runtimeMissionsDir
    });

    if (record.status.phase !== 'init') {
      throw new Error(`MISSION_NOT_RUNNABLE: ${record.missionId}: phase=${record.status.phase}`);
    }

    advanceRuntimeMissionPhase({
      missionId: record.missionId,
      nextPhase: 'planning',
      nextStatus: 'running',
      rootDir: options.runtimeMissionsDir
    });

    advanceRuntimeMissionPhase({
      missionId: record.missionId,
      nextPhase: 'execution',
      nextStatus: 'running',
      rootDir: options.runtimeMissionsDir
    });

    try {
      const missionContext = Object.fromEntries(
        Object.entries({
          missionType: record.template.missionType,
          objectives: record.template.objectives,
          successCriteria: record.template.successCriteria,
          deliverables: record.template.deliverables
        }).sort(([left], [right]) => left.localeCompare(right))
      );

      const executed = await executeMissionWorkflow({
        journal,
        missionId: record.missionId,
        projectId: record.template.projectId,
        workflowId: record.template.workflowId,
        missionParameters: {},
        missionContext,
        workflowsDir: options.workflowsDir
      });

      advanceRuntimeMissionPhase({
        missionId: record.missionId,
        nextPhase: 'verification',
        nextStatus: 'running',
        rootDir: options.runtimeMissionsDir
      });

      assertMissionArtifacts({
        template: record.template,
        artifactsDir: record.artifactsDir
      });

      const delivered = advanceRuntimeMissionPhase({
        missionId: record.missionId,
        nextPhase: 'delivery',
        nextStatus: 'completed',
        rootDir: options.runtimeMissionsDir
      });

      return {
        missionId: record.missionId,
        template: record.template.missionId,
        teamId: record.template.teamId,
        workflowId: record.template.workflowId,
        workflowRun: executed.runId,
        status: delivered.status,
        phase: delivered.phase
      };
    } catch (error) {
      const failed = setRuntimeMissionResult({
        missionId: record.missionId,
        status: 'failed',
        rootDir: options.runtimeMissionsDir
      });

      throw new Error(
        `MISSION_RUN_FAILED: ${record.missionId}: status=${failed.status}: ${error instanceof Error ? error.message : 'unknown_error'}`
      );
    }
  }

  return {
    createMission,
    listRuntimeMissions,
    runMission,
    missionStatus,
    startMission,
    listMissions,
    inspectMission,
    cancelMission
  };
}

export type MissionService = ReturnType<typeof createMissionService>;
