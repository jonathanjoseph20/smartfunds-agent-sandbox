import {
  createMissionReviewProjection,
  type MissionReviewProjectionEngine,
} from './mission-review-projection.ts';

export function createMissionReviewInspection(options: {
  projection?: MissionReviewProjectionEngine;
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
  const projection = options.projection ?? createMissionReviewProjection({
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

  function listReviewQueueEntries() {
    return projection.summarizeQueue();
  }

  function inspectReviewQueueEntry(input: { missionRunId: string }) {
    return projection.projectOne(input).queueEntry;
  }

  function inspectGovernanceStatus(input: { missionRunId: string }) {
    const projected = projection.projectOne(input);
    return {
      missionRunId: input.missionRunId,
      governanceStatus: projected.governanceStatus,
      queueState: projected.queueState,
    };
  }

  function inspectReviewRequirements(input: { missionRunId: string }) {
    return projection.projectOne(input).reviewRequirements;
  }

  function inspectDecisionHistory(input: { missionRunId: string }) {
    return projection.projectOne(input).decisionHistory;
  }

  function inspectDecisionOutcome(input: { missionRunId: string }) {
    const projected = projection.projectOne(input);

    return {
      missionRunId: input.missionRunId,
      decisionOutcome: projected.decisionOutcome,
      activeDecisionRecordId: projected.activeDecisionRecordId,
    };
  }

  return {
    listReviewQueueEntries,
    inspectReviewQueueEntry,
    inspectGovernanceStatus,
    inspectReviewRequirements,
    inspectDecisionHistory,
    inspectDecisionOutcome,
  };
}

export type MissionReviewInspection = ReturnType<typeof createMissionReviewInspection>;
