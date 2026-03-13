import {
  createMissionPortfolioAttentionProjection,
  type MissionPortfolioAttentionProjectionEngine,
} from './mission-portfolio-attention-projection.ts';
import {
  createMissionPortfolioProjection,
  type MissionPortfolioProjectionEngine,
} from './mission-portfolio-projection.ts';
import {
  createMissionPortfolioResolutionProjection,
  type MissionPortfolioResolutionProjectionEngine,
} from './mission-portfolio-resolution-projection.ts';
import {
  createCrossPortfolioMissionIntelligenceRegistry,
  type CrossPortfolioMissionIntelligenceRegistry,
} from './cross-portfolio-mission-intelligence-registry.ts';
import { deriveCrossPortfolioSharedDependencies } from './cross-portfolio-shared-dependency.ts';
import { deriveCrossPortfolioBlockingClusters } from './cross-portfolio-blocking-cluster.ts';
import { deriveCrossPortfolioEscalationPatterns } from './cross-portfolio-escalation-pattern.ts';
import { deriveCrossPortfolioSystemicRiskPosture } from './cross-portfolio-risk.ts';
import { deriveCrossPortfolioReadinessPosture } from './cross-portfolio-readiness.ts';
import { uniqueSortedStrings } from './cross-portfolio-mission-intelligence-identity.ts';
import type {
  CrossPortfolioIntelligenceOutcome,
  CrossPortfolioMissionIntelligenceProjection,
  CrossPortfolioMissionIntelligenceSet,
  CrossPortfolioPortfolioSignal,
} from './cross-portfolio-mission-intelligence-types.ts';

function deriveIntelligenceOutcome(input: {
  riskPosture: string;
  readinessPosture: string;
  sharedDependencyCount: number;
  systemicBlockingClusterCount: number;
  escalationPatternCount: number;
}): CrossPortfolioIntelligenceOutcome {
  if (input.riskPosture === 'inconclusive' || input.readinessPosture === 'inconclusive') {
    return 'inconclusive';
  }

  if (input.riskPosture === 'blocked' || input.readinessPosture === 'blocked') {
    return 'systemically_blocked';
  }

  if (input.riskPosture === 'critical' || input.riskPosture === 'unstable') {
    return 'systemically_unstable';
  }

  if (input.systemicBlockingClusterCount > 0 || input.escalationPatternCount > 0) {
    return 'attention_required';
  }

  if (input.sharedDependencyCount > 0 || input.riskPosture === 'degraded' || input.readinessPosture === 'degraded' || input.readinessPosture === 'partially_ready') {
    return 'watch';
  }

  return 'clear';
}

function toPortfolioSignal(input: {
  coordination: ReturnType<MissionPortfolioProjectionEngine['projectOne']>;
  attention: ReturnType<MissionPortfolioAttentionProjectionEngine['projectOne']>;
  resolution: ReturnType<MissionPortfolioResolutionProjectionEngine['projectOne']>;
}): CrossPortfolioPortfolioSignal {
  const reasonTokens = uniqueSortedStrings([
    `readiness:${input.coordination.readinessState}`,
    `health:${input.coordination.healthState}`,
    `governance:${input.coordination.governancePosture}`,
    `attention:${input.attention.attentionStatus}`,
    `resolution:${input.resolution.resolutionStatus}`,
    `closure_eligibility:${input.resolution.closureEligibility}`,
    ...input.coordination.blockingClusters.flatMap((entry) => entry.reasonTokens),
    ...input.attention.attentionRequirements.flatMap((entry) => entry.reasonTokens),
    ...input.attention.escalations.flatMap((entry) => entry.reasonTokens),
    ...input.resolution.stabilization.reasonTokens,
    ...input.resolution.resolution.reasonTokens,
    ...input.resolution.closureEligibilityRecord.reasonTokens,
  ]);

  return {
    missionPortfolioId: input.coordination.missionPortfolioId,
    displayName: input.coordination.displayName,
    readinessState: input.coordination.readinessState,
    healthState: input.coordination.healthState,
    governancePosture: input.coordination.governancePosture,
    linkedBlockingClusterIds: uniqueSortedStrings(input.coordination.blockingClusters.map((entry) => entry.portfolioBlockingClusterId)),
    attentionStatus: input.attention.attentionStatus,
    attentionRequirementClasses: uniqueSortedStrings(input.attention.attentionRequirements.map((entry) => entry.requirementClass)),
    openEscalationClasses: uniqueSortedStrings(input.attention.escalations.filter((entry) => entry.state === 'open').map((entry) => entry.escalationClass)),
    openEscalationSeverities: uniqueSortedStrings(input.attention.escalations.filter((entry) => entry.state === 'open').map((entry) => entry.severity)),
    resolutionStatus: input.resolution.resolutionStatus,
    closureEligibility: input.resolution.closureEligibility,
    closureState: input.resolution.closureState,
    resolutionOutcome: input.resolution.resolutionOutcome,
    criticalMissionCount: input.coordination.priorityDistribution.criticalMissionCount,
    highMissionCount: input.coordination.priorityDistribution.highMissionCount,
    reasonTokens,
  };
}

function buildSetProjection(input: {
  set: CrossPortfolioMissionIntelligenceSet;
  allSignals: CrossPortfolioPortfolioSignal[];
}): CrossPortfolioMissionIntelligenceProjection {
  const signals = input.allSignals
    .filter((entry) => input.set.portfolioIds.includes(entry.missionPortfolioId))
    .sort((left, right) => left.missionPortfolioId.localeCompare(right.missionPortfolioId));

  const sharedDependencies = deriveCrossPortfolioSharedDependencies({
    crossPortfolioMissionIntelligenceSetId: input.set.crossPortfolioMissionIntelligenceSetId,
    portfolioSignals: signals,
  });
  const systemicBlockingClusters = deriveCrossPortfolioBlockingClusters({
    crossPortfolioMissionIntelligenceSetId: input.set.crossPortfolioMissionIntelligenceSetId,
    portfolioSignals: signals,
  });
  const escalationPatterns = deriveCrossPortfolioEscalationPatterns({
    crossPortfolioMissionIntelligenceSetId: input.set.crossPortfolioMissionIntelligenceSetId,
    portfolioSignals: signals,
  });

  const systemicRiskPosture = deriveCrossPortfolioSystemicRiskPosture({
    portfolioSignals: signals,
    systemicBlockingClusters,
    escalationPatterns,
  });
  const readinessPosture = deriveCrossPortfolioReadinessPosture({
    portfolioSignals: signals,
  });
  const intelligenceOutcome = deriveIntelligenceOutcome({
    riskPosture: systemicRiskPosture,
    readinessPosture,
    sharedDependencyCount: sharedDependencies.length,
    systemicBlockingClusterCount: systemicBlockingClusters.length,
    escalationPatternCount: escalationPatterns.length,
  });

  const linkedPortfolioSummaries = signals.map((entry) => ({
    missionPortfolioId: entry.missionPortfolioId,
    displayName: entry.displayName,
    readinessState: entry.readinessState,
    healthState: entry.healthState,
    governancePosture: entry.governancePosture,
    attentionStatus: entry.attentionStatus,
    resolutionStatus: entry.resolutionStatus,
    closureEligibility: entry.closureEligibility,
  }));

  const statusPreview = {
    crossPortfolioMissionIntelligenceSetId: input.set.crossPortfolioMissionIntelligenceSetId,
    setType: input.set.setType,
    portfolioIds: input.set.portfolioIds,
    systemicRiskPosture,
    readinessPosture,
    intelligenceOutcome,
    sharedDependencyIds: sharedDependencies.map((entry) => entry.crossPortfolioSharedDependencyId),
    systemicBlockingClusterIds: systemicBlockingClusters.map((entry) => entry.systemicBlockingClusterId),
    escalationPatternIds: escalationPatterns.map((entry) => entry.crossPortfolioEscalationPatternId),
  } as Record<string, unknown>;

  const reportPreview = {
    ...statusPreview,
    displayName: input.set.displayName,
    membershipSummary: input.set.membershipSummary,
    sharedDependencies,
    systemicBlockingClusters,
    escalationPatterns,
    linkedPortfolioSummaries,
  } as Record<string, unknown>;

  return {
    crossPortfolioMissionIntelligenceSetId: input.set.crossPortfolioMissionIntelligenceSetId,
    displayName: input.set.displayName,
    setType: input.set.setType,
    portfolioIds: [...input.set.portfolioIds],
    membershipSummary: input.set.membershipSummary,
    sharedDependencies,
    systemicBlockingClusters,
    escalationPatterns,
    systemicRiskPosture,
    readinessPosture,
    intelligenceOutcome,
    linkedPortfolioSummaries,
    statusPreview,
    reportPreview,
  };
}

export function createCrossPortfolioMissionIntelligenceProjection(options: {
  registry?: CrossPortfolioMissionIntelligenceRegistry;
  coordinationProjection?: MissionPortfolioProjectionEngine;
  attentionProjection?: MissionPortfolioAttentionProjectionEngine;
  resolutionProjection?: MissionPortfolioResolutionProjectionEngine;
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
  const registry = options.registry ?? createCrossPortfolioMissionIntelligenceRegistry();

  const coordinationProjection = options.coordinationProjection ?? createMissionPortfolioProjection({
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

  const attentionProjection = options.attentionProjection ?? createMissionPortfolioAttentionProjection({
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

  const resolutionProjection = options.resolutionProjection ?? createMissionPortfolioResolutionProjection({
    attentionProjection,
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

  function buildSignals(): CrossPortfolioPortfolioSignal[] {
    const portfolioIds = coordinationProjection.summarizeList()
      .map((entry) => entry.missionPortfolioId)
      .sort((left, right) => left.localeCompare(right));

    return portfolioIds
      .map((missionPortfolioId) => toPortfolioSignal({
        coordination: coordinationProjection.projectOne({ missionPortfolioId }),
        attention: attentionProjection.projectOne({ missionPortfolioId }),
        resolution: resolutionProjection.projectOne({ missionPortfolioId }),
      }))
      .sort((left, right) => left.missionPortfolioId.localeCompare(right.missionPortfolioId));
  }

  function projectAll(): CrossPortfolioMissionIntelligenceProjection[] {
    const signals = buildSignals();
    const sets = registry.listDefaultIntelligenceSets({
      portfolioIds: signals.map((entry) => entry.missionPortfolioId),
    });

    return sets
      .map((set) => buildSetProjection({
        set,
        allSignals: signals,
      }))
      .sort((left, right) => left.crossPortfolioMissionIntelligenceSetId.localeCompare(right.crossPortfolioMissionIntelligenceSetId));
  }

  function projectOne(input: { crossPortfolioMissionIntelligenceSetId: string }): CrossPortfolioMissionIntelligenceProjection {
    const found = projectAll().find((entry) => entry.crossPortfolioMissionIntelligenceSetId === input.crossPortfolioMissionIntelligenceSetId);
    if (!found) {
      throw new Error('CROSS_PORTFOLIO_INTELLIGENCE_SET_NOT_FOUND');
    }
    return found;
  }

  function listIntelligenceSets() {
    return projectAll().map((entry) => ({
      crossPortfolioMissionIntelligenceSetId: entry.crossPortfolioMissionIntelligenceSetId,
      displayName: entry.displayName,
      setType: entry.setType,
      portfolioIds: entry.portfolioIds,
      systemicRiskPosture: entry.systemicRiskPosture,
      readinessPosture: entry.readinessPosture,
      intelligenceOutcome: entry.intelligenceOutcome,
    }));
  }

  return {
    projectOne,
    projectAll,
    listIntelligenceSets,
  };
}

export type CrossPortfolioMissionIntelligenceProjectionEngine = ReturnType<typeof createCrossPortfolioMissionIntelligenceProjection>;
