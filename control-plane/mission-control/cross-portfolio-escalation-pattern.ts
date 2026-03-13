import {
  deriveCrossPortfolioEscalationPatternId,
  uniqueSortedStrings,
} from './cross-portfolio-mission-intelligence-identity.ts';
import type {
  CrossPortfolioEscalationPattern,
  CrossPortfolioEscalationPatternClass,
  CrossPortfolioPortfolioSignal,
  SystemicBlockingClusterSeverity,
} from './cross-portfolio-mission-intelligence-types.ts';

function severityForCount(count: number): SystemicBlockingClusterSeverity {
  if (count >= 4) {
    return 'critical';
  }
  if (count >= 3) {
    return 'high';
  }
  if (count >= 2) {
    return 'medium';
  }
  return 'low';
}

function buildPattern(input: {
  crossPortfolioMissionIntelligenceSetId: string;
  patternClass: CrossPortfolioEscalationPatternClass;
  portfolioIds: string[];
  reasonTokens: string[];
}): CrossPortfolioEscalationPattern | null {
  const portfolioIds = uniqueSortedStrings(input.portfolioIds);
  if (portfolioIds.length < 2) {
    return null;
  }

  const severity = severityForCount(portfolioIds.length);
  const reasonTokens = uniqueSortedStrings([
    ...input.reasonTokens,
    `portfolio_count:${String(portfolioIds.length)}`,
    `pattern_class:${input.patternClass}`,
    `severity:${severity}`,
  ]);

  return {
    crossPortfolioEscalationPatternId: deriveCrossPortfolioEscalationPatternId({
      crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
      portfolioIds,
      patternClass: input.patternClass,
      severity,
      reasonTokens,
    }),
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    portfolioIds,
    patternClass: input.patternClass,
    severity,
    reasonTokens,
    state: 'active',
  };
}

export function deriveCrossPortfolioEscalationPatterns(input: {
  crossPortfolioMissionIntelligenceSetId: string;
  portfolioSignals: CrossPortfolioPortfolioSignal[];
}): CrossPortfolioEscalationPattern[] {
  const patterns: CrossPortfolioEscalationPattern[] = [];

  const blockingEscalationPortfolios = input.portfolioSignals
    .filter((entry) => entry.openEscalationClasses.includes('portfolio_blocked') || entry.linkedBlockingClusterIds.length > 0)
    .map((entry) => entry.missionPortfolioId);
  const governanceBlockedPortfolios = input.portfolioSignals
    .filter((entry) => entry.governancePosture === 'decision_blocked' || entry.governancePosture === 'deferred')
    .map((entry) => entry.missionPortfolioId);
  const regressionPortfolios = input.portfolioSignals
    .filter((entry) => entry.resolutionStatus === 'reopened' || entry.resolutionOutcome === 'reopened' || entry.resolutionOutcome === 'deferred')
    .map((entry) => entry.missionPortfolioId);
  const criticalPriorityPortfolios = input.portfolioSignals
    .filter((entry) => entry.criticalMissionCount > 0)
    .map((entry) => entry.missionPortfolioId);
  const unresolvedAttentionPortfolios = input.portfolioSignals
    .filter((entry) => entry.attentionStatus === 'awaiting_attention' || entry.attentionStatus === 'under_attention' || entry.attentionStatus === 'escalated')
    .map((entry) => entry.missionPortfolioId);
  const inconclusivePortfolios = input.portfolioSignals
    .filter((entry) => (
      entry.readinessState === 'inconclusive'
      || entry.healthState === 'inconclusive'
      || entry.attentionStatus === 'inconclusive'
      || entry.resolutionStatus === 'inconclusive'
      || entry.closureEligibility === 'inconclusive'
      || entry.resolutionOutcome === 'inconclusive'
    ))
    .map((entry) => entry.missionPortfolioId);

  const repeatedBlockingEscalation = buildPattern({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    patternClass: 'repeated_blocking_escalation',
    portfolioIds: blockingEscalationPortfolios,
    reasonTokens: ['blocking_escalation_repeated'],
  });
  if (repeatedBlockingEscalation) {
    patterns.push(repeatedBlockingEscalation);
  }

  const repeatedGovernanceBlock = buildPattern({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    patternClass: 'repeated_governance_block',
    portfolioIds: governanceBlockedPortfolios,
    reasonTokens: ['governance_block_repeated'],
  });
  if (repeatedGovernanceBlock) {
    patterns.push(repeatedGovernanceBlock);
  }

  const repeatedResolutionRegression = buildPattern({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    patternClass: 'repeated_resolution_regression',
    portfolioIds: regressionPortfolios,
    reasonTokens: ['resolution_regression_repeated'],
  });
  if (repeatedResolutionRegression) {
    patterns.push(repeatedResolutionRegression);
  }

  const criticalPriorityConcentration = buildPattern({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    patternClass: 'critical_priority_concentration',
    portfolioIds: criticalPriorityPortfolios,
    reasonTokens: ['critical_priority_concentration_detected'],
  });
  if (criticalPriorityConcentration) {
    patterns.push(criticalPriorityConcentration);
  }

  const unresolvedAttentionPattern = buildPattern({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    patternClass: 'unresolved_attention_pattern',
    portfolioIds: unresolvedAttentionPortfolios,
    reasonTokens: ['unresolved_attention_repeated'],
  });
  if (unresolvedAttentionPattern) {
    patterns.push(unresolvedAttentionPattern);
  }

  const systemicInconclusivePattern = buildPattern({
    crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
    patternClass: 'systemic_inconclusive_pattern',
    portfolioIds: inconclusivePortfolios,
    reasonTokens: ['inconclusive_pattern_detected'],
  });
  if (systemicInconclusivePattern) {
    patterns.push(systemicInconclusivePattern);
  }

  return patterns
    .sort((left, right) => left.crossPortfolioEscalationPatternId.localeCompare(right.crossPortfolioEscalationPatternId));
}
