import {
  createMissionPortfolioHistoryStore,
  type MissionPortfolioHistoryStore,
} from './mission-portfolio-history-store.ts';
import {
  createMissionPortfolioProjection,
  type MissionPortfolioProjectionEngine,
} from './mission-portfolio-projection.ts';

function toReasonTokens(input: { projection: ReturnType<MissionPortfolioProjectionEngine['projectOne']> }): string[] {
  const tokens = [
    `readiness:${input.projection.readinessState}`,
    `health:${input.projection.healthState}`,
    `governance:${input.projection.governancePosture}`,
    `mission_count:${String(input.projection.missionRunIds.length)}`,
    `blocking_cluster_count:${String(input.projection.blockingClusters.length)}`,
  ];

  return tokens.sort((left, right) => left.localeCompare(right));
}

export function createMissionPortfolioInspection(options: {
  projection?: MissionPortfolioProjectionEngine;
  historyStore?: MissionPortfolioHistoryStore;
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
  const projection = options.projection ?? createMissionPortfolioProjection({
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

  const historyStore = options.historyStore ?? createMissionPortfolioHistoryStore({
    artifactsRoot: options.missionControlArtifactsRoot,
  });

  function evaluateMissionPortfolio(input: { missionPortfolioId: string }) {
    const projected = projection.projectOne(input);
    const reasonTokens = toReasonTokens({ projection: projected });

    historyStore.append({
      missionPortfolioId: projected.missionPortfolioId,
      eventType: 'mission_portfolio_created',
      reasonTokens,
      payload: {
        missionPortfolioId: projected.missionPortfolioId,
        displayName: projected.displayName,
        portfolioType: projected.portfolioType,
      },
    });

    for (const membership of projected.memberships) {
      historyStore.append({
        missionPortfolioId: projected.missionPortfolioId,
        eventType: membership.state === 'active'
          ? 'mission_portfolio_membership_added'
          : 'mission_portfolio_membership_removed',
        reasonTokens: membership.reasonTokens,
        payload: {
          membership,
        },
      });
    }

    for (const cluster of projected.blockingClusters) {
      historyStore.append({
        missionPortfolioId: projected.missionPortfolioId,
        eventType: cluster.state === 'active'
          ? 'mission_portfolio_blocking_detected'
          : 'mission_portfolio_blocking_resolved',
        reasonTokens: cluster.reasonTokens,
        payload: {
          blockingCluster: cluster,
        },
      });
    }

    historyStore.append({
      missionPortfolioId: projected.missionPortfolioId,
      eventType: 'mission_portfolio_governance_updated',
      reasonTokens,
      payload: {
        governancePosture: projected.governancePosture,
      },
    });

    historyStore.append({
      missionPortfolioId: projected.missionPortfolioId,
      eventType: 'mission_portfolio_readiness_updated',
      reasonTokens,
      payload: {
        readinessState: projected.readinessState,
        healthState: projected.healthState,
      },
    });

    return {
      projection: projected,
      history: historyStore.load({ missionPortfolioId: projected.missionPortfolioId }),
    };
  }

  function listMissionPortfolios() {
    return projection.summarizeList();
  }

  function inspectMissionPortfolio(input: { missionPortfolioId: string }) {
    return projection.projectOne(input);
  }

  function inspectMissionPortfolioReadiness(input: { missionPortfolioId: string }) {
    const projected = inspectMissionPortfolio(input);
    return {
      missionPortfolioId: projected.missionPortfolioId,
      readinessState: projected.readinessState,
      missionRunIds: projected.missionRunIds,
      blockingClusters: projected.blockingClusters,
    };
  }

  function inspectMissionPortfolioHealth(input: { missionPortfolioId: string }) {
    const projected = inspectMissionPortfolio(input);
    return {
      missionPortfolioId: projected.missionPortfolioId,
      healthState: projected.healthState,
      missionRunIds: projected.missionRunIds,
      blockingClusterCount: projected.blockingClusters.length,
    };
  }

  function inspectMissionPortfolioGovernancePosture(input: { missionPortfolioId: string }) {
    const projected = inspectMissionPortfolio(input);
    return {
      missionPortfolioId: projected.missionPortfolioId,
      governancePosture: projected.governancePosture,
      linkedDecisionSummaries: projected.linkedDecisionSummaries,
    };
  }

  function inspectMissionPortfolioBlocking(input: { missionPortfolioId: string }) {
    return inspectMissionPortfolio(input).blockingClusters;
  }

  function inspectMissionPortfolioMembership(input: { missionPortfolioId: string }) {
    const projected = inspectMissionPortfolio(input);
    return {
      missionPortfolioId: projected.missionPortfolioId,
      missionRunIds: projected.missionRunIds,
      membershipSummaries: projected.membershipSummaries,
      memberships: projected.memberships,
    };
  }

  function inspectMissionPortfolioHistory(input: { missionPortfolioId: string }) {
    return historyStore.load(input);
  }

  return {
    evaluateMissionPortfolio,
    listMissionPortfolios,
    inspectMissionPortfolio,
    inspectMissionPortfolioReadiness,
    inspectMissionPortfolioHealth,
    inspectMissionPortfolioGovernancePosture,
    inspectMissionPortfolioBlocking,
    inspectMissionPortfolioMembership,
    inspectMissionPortfolioHistory,
  };
}

export type MissionPortfolioInspection = ReturnType<typeof createMissionPortfolioInspection>;
