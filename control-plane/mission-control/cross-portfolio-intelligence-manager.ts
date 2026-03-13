import {
  createCrossPortfolioIntelligenceHistoryStore,
  type CrossPortfolioIntelligenceHistoryStore,
} from './cross-portfolio-intelligence-history-store.ts';
import {
  createCrossPortfolioMissionIntelligenceMaterializer,
  type CrossPortfolioMissionIntelligenceMaterializer,
} from './cross-portfolio-intelligence-materializer.ts';
import {
  createCrossPortfolioMissionIntelligenceProjection,
  type CrossPortfolioMissionIntelligenceProjectionEngine,
} from './cross-portfolio-intelligence-projection.ts';
import { uniqueSortedStrings } from './cross-portfolio-mission-intelligence-identity.ts';

export function createCrossPortfolioMissionIntelligenceManager(options: {
  projection?: CrossPortfolioMissionIntelligenceProjectionEngine;
  historyStore?: CrossPortfolioIntelligenceHistoryStore;
  materializer?: CrossPortfolioMissionIntelligenceMaterializer;
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
  const historyStore = options.historyStore ?? createCrossPortfolioIntelligenceHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

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

  const materializer = options.materializer ?? createCrossPortfolioMissionIntelligenceMaterializer({
    projection,
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

  function evaluateIntelligenceSet(input: { crossPortfolioMissionIntelligenceSetId: string }) {
    const projected = projection.projectOne(input);

    historyStore.appendEvent({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      eventType: 'cross_portfolio_intelligence_set_created',
      reasonTokens: uniqueSortedStrings([
        `set_type:${projected.setType}`,
        `portfolio_count:${String(projected.portfolioIds.length)}`,
      ]),
      payload: {
        crossPortfolioMissionIntelligenceSetId: projected.crossPortfolioMissionIntelligenceSetId,
        setType: projected.setType,
        portfolioIds: projected.portfolioIds,
      },
    });

    for (const dependency of projected.sharedDependencies) {
      historyStore.appendEvent({
        crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
        eventType: 'cross_portfolio_shared_dependency_detected',
        reasonTokens: dependency.reasonTokens,
        payload: {
          sharedDependency: dependency,
        },
      });
    }

    for (const cluster of projected.systemicBlockingClusters) {
      historyStore.appendEvent({
        crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
        eventType: 'cross_portfolio_blocking_cluster_detected',
        reasonTokens: cluster.reasonTokens,
        payload: {
          systemicBlockingCluster: cluster,
        },
      });
    }

    for (const pattern of projected.escalationPatterns) {
      historyStore.appendEvent({
        crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
        eventType: 'cross_portfolio_escalation_pattern_detected',
        reasonTokens: pattern.reasonTokens,
        payload: {
          escalationPattern: pattern,
        },
      });
    }

    historyStore.appendEvent({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      eventType: 'cross_portfolio_risk_posture_updated',
      reasonTokens: uniqueSortedStrings([
        `systemic_risk_posture:${projected.systemicRiskPosture}`,
        `intelligence_outcome:${projected.intelligenceOutcome}`,
      ]),
      payload: {
        systemicRiskPosture: projected.systemicRiskPosture,
        intelligenceOutcome: projected.intelligenceOutcome,
      },
    });

    historyStore.appendEvent({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      eventType: 'cross_portfolio_readiness_updated',
      reasonTokens: uniqueSortedStrings([
        `readiness_posture:${projected.readinessPosture}`,
        `intelligence_outcome:${projected.intelligenceOutcome}`,
      ]),
      payload: {
        readinessPosture: projected.readinessPosture,
        intelligenceOutcome: projected.intelligenceOutcome,
      },
    });

    return projection.projectOne(input);
  }

  function materializeIntelligenceSet(input: { crossPortfolioMissionIntelligenceSetId: string }) {
    const projected = evaluateIntelligenceSet(input);
    const materialized = materializer.materializeOne(input);

    historyStore.appendEvent({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      eventType: 'cross_portfolio_materialized',
      reasonTokens: uniqueSortedStrings([
        `systemic_risk_posture:${projected.systemicRiskPosture}`,
        `readiness_posture:${projected.readinessPosture}`,
        `intelligence_outcome:${projected.intelligenceOutcome}`,
      ]),
      payload: {
        crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
        systemicRiskPosture: projected.systemicRiskPosture,
        readinessPosture: projected.readinessPosture,
        intelligenceOutcome: projected.intelligenceOutcome,
      },
    });

    return materialized;
  }

  return {
    evaluateIntelligenceSet,
    materializeIntelligenceSet,
  };
}

export type CrossPortfolioMissionIntelligenceManager = ReturnType<typeof createCrossPortfolioMissionIntelligenceManager>;
