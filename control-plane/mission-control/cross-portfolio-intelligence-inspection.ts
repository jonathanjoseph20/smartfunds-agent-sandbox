import {
  createCrossPortfolioIntelligenceHistoryStore,
  type CrossPortfolioIntelligenceHistoryStore,
} from './cross-portfolio-intelligence-history-store.ts';
import {
  createCrossPortfolioMissionIntelligenceProjection,
  type CrossPortfolioMissionIntelligenceProjectionEngine,
} from './cross-portfolio-intelligence-projection.ts';

export function createCrossPortfolioMissionIntelligenceInspection(options: {
  projection?: CrossPortfolioMissionIntelligenceProjectionEngine;
  historyStore?: CrossPortfolioIntelligenceHistoryStore;
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
  const projection = options.projection ?? createCrossPortfolioMissionIntelligenceProjection({
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

  const historyStore = options.historyStore ?? createCrossPortfolioIntelligenceHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function listIntelligenceSets() {
    return projection.listIntelligenceSets();
  }

  function inspectIntelligenceSet(input: { crossPortfolioMissionIntelligenceSetId: string }) {
    return projection.projectOne(input);
  }

  function inspectSharedDependencies(input: { crossPortfolioMissionIntelligenceSetId: string }) {
    return inspectIntelligenceSet(input).sharedDependencies;
  }

  function inspectBlockingClusters(input: { crossPortfolioMissionIntelligenceSetId: string }) {
    return inspectIntelligenceSet(input).systemicBlockingClusters;
  }

  function inspectEscalationPatterns(input: { crossPortfolioMissionIntelligenceSetId: string }) {
    return inspectIntelligenceSet(input).escalationPatterns;
  }

  function inspectRiskPosture(input: { crossPortfolioMissionIntelligenceSetId: string }) {
    const projected = inspectIntelligenceSet(input);
    return {
      crossPortfolioMissionIntelligenceSetId: projected.crossPortfolioMissionIntelligenceSetId,
      systemicRiskPosture: projected.systemicRiskPosture,
      intelligenceOutcome: projected.intelligenceOutcome,
    };
  }

  function inspectReadinessPosture(input: { crossPortfolioMissionIntelligenceSetId: string }) {
    const projected = inspectIntelligenceSet(input);
    return {
      crossPortfolioMissionIntelligenceSetId: projected.crossPortfolioMissionIntelligenceSetId,
      readinessPosture: projected.readinessPosture,
      intelligenceOutcome: projected.intelligenceOutcome,
    };
  }

  function inspectIntelligenceHistory(input: { crossPortfolioMissionIntelligenceSetId: string }) {
    return historyStore.load(input);
  }

  return {
    listIntelligenceSets,
    inspectIntelligenceSet,
    inspectSharedDependencies,
    inspectBlockingClusters,
    inspectEscalationPatterns,
    inspectRiskPosture,
    inspectReadinessPosture,
    inspectIntelligenceHistory,
  };
}

export type CrossPortfolioMissionIntelligenceInspection = ReturnType<typeof createCrossPortfolioMissionIntelligenceInspection>;
