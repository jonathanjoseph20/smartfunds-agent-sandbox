import {
  createMissionPortfolioResolutionProjection,
  type MissionPortfolioResolutionProjectionEngine,
} from './mission-portfolio-resolution-projection.ts';

export function createMissionPortfolioResolutionInspection(options: {
  projection?: MissionPortfolioResolutionProjectionEngine;
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
  const projection = options.projection ?? createMissionPortfolioResolutionProjection({
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

  function listResolutionQueue() {
    return projection.listResolutionQueue();
  }

  function inspectStabilization(input: { missionPortfolioId: string }) {
    return projection.projectOne(input).stabilization;
  }

  function inspectResolutionStatus(input: { missionPortfolioId: string }) {
    return projection.projectOne(input).resolution;
  }

  function inspectClosureEligibility(input: { missionPortfolioId: string }) {
    return projection.projectOne(input).closureEligibilityRecord;
  }

  function inspectClosureState(input: { missionPortfolioId: string }) {
    const projected = projection.projectOne(input);
    return {
      missionPortfolioId: input.missionPortfolioId,
      portfolioResolutionQueueEntryId: projected.portfolioResolutionQueueEntryId,
      closureState: projected.closureState,
    };
  }

  function inspectResolutionActionHistory(input: { missionPortfolioId: string }) {
    return projection.projectOne(input).resolutionActionHistory;
  }

  function inspectResolutionOutcome(input: { missionPortfolioId: string }) {
    const projected = projection.projectOne(input);
    return {
      missionPortfolioId: input.missionPortfolioId,
      resolutionOutcome: projected.resolutionOutcome,
      activeResolutionActionRecordId: projected.activeResolutionActionRecordId,
    };
  }

  return {
    listResolutionQueue,
    inspectStabilization,
    inspectResolutionStatus,
    inspectClosureEligibility,
    inspectClosureState,
    inspectResolutionActionHistory,
    inspectResolutionOutcome,
  };
}

export type MissionPortfolioResolutionInspection = ReturnType<typeof createMissionPortfolioResolutionInspection>;
