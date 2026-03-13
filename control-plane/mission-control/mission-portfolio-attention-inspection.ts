import {
  createMissionPortfolioAttentionProjection,
  type MissionPortfolioAttentionProjectionEngine,
} from './mission-portfolio-attention-projection.ts';

export function createMissionPortfolioAttentionInspection(options: {
  projection?: MissionPortfolioAttentionProjectionEngine;
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
  const projection = options.projection ?? createMissionPortfolioAttentionProjection({
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

  function listPortfolioAttentionQueue() {
    return projection.listAttentionQueue();
  }

  function inspectPortfolioAttentionStatus(input: { missionPortfolioId: string }) {
    const projected = projection.projectOne(input);
    return {
      missionPortfolioId: input.missionPortfolioId,
      portfolioAttentionQueueEntryId: projected.portfolioAttentionQueueEntryId,
      attentionStatus: projected.attentionStatus,
      activeRequirementClasses: projected.activeRequirementClasses,
      actionOutcome: projected.actionOutcome,
      activeActionRecordId: projected.activeActionRecordId,
      queueState: projected.queueEntry?.queueState ?? null,
    };
  }

  function inspectPortfolioAttentionRequirements(input: { missionPortfolioId: string }) {
    return projection.projectOne(input).attentionRequirements;
  }

  function inspectPortfolioEscalations(input: { missionPortfolioId: string }) {
    return projection.projectOne(input).escalations;
  }

  function inspectPortfolioActionHistory(input: { missionPortfolioId: string }) {
    return projection.projectOne(input).actionHistory;
  }

  function inspectPortfolioActionOutcome(input: { missionPortfolioId: string }) {
    const projected = projection.projectOne(input);
    return {
      missionPortfolioId: input.missionPortfolioId,
      actionOutcome: projected.actionOutcome,
      activeActionRecordId: projected.activeActionRecordId,
    };
  }

  return {
    listPortfolioAttentionQueue,
    inspectPortfolioAttentionStatus,
    inspectPortfolioAttentionRequirements,
    inspectPortfolioEscalations,
    inspectPortfolioActionHistory,
    inspectPortfolioActionOutcome,
  };
}

export type MissionPortfolioAttentionInspection = ReturnType<typeof createMissionPortfolioAttentionInspection>;
