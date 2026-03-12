import {
  createMissionRunHistoryStore,
  type MissionRunHistoryStore,
} from './mission-run-history-store.ts';
import {
  createMissionRunProjection,
  type MissionRunProjectionEngine,
} from './mission-run-projection.ts';
import type {
  MissionRunHistoryEventType,
  MissionRunProjection,
} from './mission-run-types.ts';

function toStateEventType(projection: MissionRunProjection): MissionRunHistoryEventType {
  if (projection.operationalState === 'completed') {
    return 'mission_completed';
  }
  if (projection.operationalState === 'failed') {
    return 'mission_failed';
  }
  if (projection.operationalState === 'cancelled') {
    return 'mission_cancelled';
  }
  if (projection.operationalState === 'blocked') {
    return 'mission_blocked';
  }
  if (projection.operationalState === 'degraded' || projection.healthState === 'degraded') {
    return 'mission_degraded';
  }
  if (projection.operationalState === 'active' || projection.operationalState === 'retrying') {
    return 'mission_execution_started';
  }
  return 'mission_progress_updated';
}

function appendProjectionEvents(input: {
  projection: MissionRunProjection;
  historyStore: MissionRunHistoryStore;
}): void {
  input.historyStore.append({
    missionRunId: input.projection.missionRunId,
    missionId: input.projection.missionId,
    executionAttemptId: input.projection.executionAttemptId,
    runtimeEnvelopeId: input.projection.runtimeEnvelopeId,
    executionContractId: input.projection.executionContractId,
    eventType: 'mission_run_created',
    reason: 'mission_run_projection_generated',
    payload: {
      missionRunId: input.projection.missionRunId,
      missionId: input.projection.missionId,
      executionAttemptId: input.projection.executionAttemptId,
      runtimeEnvelopeId: input.projection.runtimeEnvelopeId,
      executionContractId: input.projection.executionContractId,
    },
  });

  input.historyStore.append({
    missionRunId: input.projection.missionRunId,
    missionId: input.projection.missionId,
    executionAttemptId: input.projection.executionAttemptId,
    runtimeEnvelopeId: input.projection.runtimeEnvelopeId,
    executionContractId: input.projection.executionContractId,
    eventType: 'mission_progress_updated',
    reason: 'mission_progress_projection_updated',
    payload: input.projection.progressSummary as unknown as Record<string, unknown>,
  });

  if (input.projection.escalations.length > 0) {
    input.historyStore.append({
      missionRunId: input.projection.missionRunId,
      missionId: input.projection.missionId,
      executionAttemptId: input.projection.executionAttemptId,
      runtimeEnvelopeId: input.projection.runtimeEnvelopeId,
      executionContractId: input.projection.executionContractId,
      eventType: 'mission_escalated',
      reason: `escalation_count:${String(input.projection.escalations.length)}`,
      payload: {
        escalationIds: input.projection.escalations.map((entry) => entry.escalationId),
      },
    });
  }

  input.historyStore.append({
    missionRunId: input.projection.missionRunId,
    missionId: input.projection.missionId,
    executionAttemptId: input.projection.executionAttemptId,
    runtimeEnvelopeId: input.projection.runtimeEnvelopeId,
    executionContractId: input.projection.executionContractId,
    eventType: toStateEventType(input.projection),
    reason: `operational_state:${input.projection.operationalState}`,
    payload: {
      operationalState: input.projection.operationalState,
      completionState: input.projection.completionState,
      healthState: input.projection.healthState,
      blockingReasons: input.projection.blockingReasons,
    },
  });
}

export function createMissionRunInspection(options: {
  projection?: MissionRunProjectionEngine;
  historyStore?: MissionRunHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
  executionAttemptArtifactsRoot?: string;
  executionJournalArtifactsRoot?: string;
  executionEngineArtifactsRoot?: string;
  taskGraphArtifactsRoot?: string;
  taskExecutionArtifactsRoot?: string;
  missionControlArtifactsRoot?: string;
} = {}) {
  const historyStore = options.historyStore ?? createMissionRunHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  const projection = options.projection ?? createMissionRunProjection({
    historyStore,
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
    missionControlArtifactsRoot: options.missionControlArtifactsRoot,
  });

  function listMissionRuns() {
    return projection.summarizeList();
  }

  function inspectMissionRun(input: { missionRunId: string }) {
    return projection.projectOne(input);
  }

  function inspectMissionProgress(input: { missionRunId: string }) {
    return inspectMissionRun(input).progressSummary;
  }

  function inspectMissionStatus(input: { missionRunId: string }) {
    return inspectMissionRun(input).statusPreview;
  }

  function inspectMissionEscalations(input: { missionRunId: string }) {
    return inspectMissionRun(input).escalations;
  }

  function inspectMissionHistory(input: { missionRunId: string }) {
    const projected = inspectMissionRun(input);
    return historyStore.load({
      missionRunId: projected.missionRunId,
      missionId: projected.missionId,
      executionAttemptId: projected.executionAttemptId,
      runtimeEnvelopeId: projected.runtimeEnvelopeId,
      executionContractId: projected.executionContractId,
    });
  }

  function evaluateMissionRun(input: { missionRunId: string }) {
    const projected = inspectMissionRun(input);
    appendProjectionEvents({
      projection: projected,
      historyStore,
    });

    return {
      projection: projected,
      history: inspectMissionHistory({ missionRunId: projected.missionRunId }),
    };
  }

  return {
    listMissionRuns,
    inspectMissionRun,
    inspectMissionProgress,
    inspectMissionStatus,
    inspectMissionEscalations,
    inspectMissionHistory,
    evaluateMissionRun,
  };
}

export type MissionRunInspection = ReturnType<typeof createMissionRunInspection>;
