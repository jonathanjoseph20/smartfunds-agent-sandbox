import type {
  CrossPortfolioEscalationPattern,
  CrossPortfolioPortfolioSignal,
  MissionControlSystemicRiskPosture,
  SystemicBlockingCluster,
} from './cross-portfolio-mission-intelligence-types.ts';

function hasCriticalSeverity(value: { severity: string }[]): boolean {
  return value.some((entry) => entry.severity === 'critical');
}

function hasHighOrWorse(value: { severity: string }[]): boolean {
  return value.some((entry) => entry.severity === 'critical' || entry.severity === 'high');
}

export function deriveCrossPortfolioSystemicRiskPosture(input: {
  portfolioSignals: CrossPortfolioPortfolioSignal[];
  systemicBlockingClusters: SystemicBlockingCluster[];
  escalationPatterns: CrossPortfolioEscalationPattern[];
}): MissionControlSystemicRiskPosture {
  if (input.portfolioSignals.length === 0) {
    return 'inconclusive';
  }

  const blockedPortfolioCount = input.portfolioSignals.filter((entry) => entry.closureEligibility === 'blocked_from_closure').length;
  const inconclusiveCount = input.portfolioSignals.filter((entry) => (
    entry.readinessState === 'inconclusive'
    || entry.healthState === 'inconclusive'
    || entry.attentionStatus === 'inconclusive'
    || entry.resolutionStatus === 'inconclusive'
  )).length;
  const degradedCount = input.portfolioSignals.filter((entry) => entry.healthState === 'degraded' || entry.readinessState === 'degraded').length;

  if (blockedPortfolioCount >= 2) {
    return 'blocked';
  }

  if (inconclusiveCount === input.portfolioSignals.length) {
    return 'inconclusive';
  }

  if (hasCriticalSeverity(input.systemicBlockingClusters) || hasCriticalSeverity(input.escalationPatterns)) {
    return 'critical';
  }

  if (hasHighOrWorse(input.systemicBlockingClusters) || hasHighOrWorse(input.escalationPatterns)) {
    return 'unstable';
  }

  if (degradedCount > 0 || input.escalationPatterns.length > 0 || input.systemicBlockingClusters.length > 0) {
    return 'degraded';
  }

  return 'clear';
}
