import {
  deriveSystemicBlockingClusterId,
  uniqueSortedStrings,
} from './cross-portfolio-mission-intelligence-identity.ts';
import type {
  CrossPortfolioPortfolioSignal,
  SystemicBlockingCluster,
  SystemicBlockingClusterSeverity,
} from './cross-portfolio-mission-intelligence-types.ts';

function severityRank(severity: string): number {
  if (severity === 'critical') {
    return 4;
  }
  if (severity === 'high') {
    return 3;
  }
  if (severity === 'medium') {
    return 2;
  }
  return 1;
}

function deriveSeverity(input: {
  portfolioSignals: CrossPortfolioPortfolioSignal[];
  sharedCount: number;
}): SystemicBlockingClusterSeverity {
  const hasCriticalEscalation = input.portfolioSignals.some((entry) => entry.openEscalationSeverities.some((severity) => severity === 'critical'));
  const hasHighEscalation = input.portfolioSignals.some((entry) => entry.openEscalationSeverities.some((severity) => severityRank(severity) >= 3));
  const hasBlockedClosure = input.portfolioSignals.some((entry) => entry.closureEligibility === 'blocked_from_closure');

  if (hasCriticalEscalation || hasBlockedClosure) {
    return 'critical';
  }
  if (input.sharedCount >= 3 || hasHighEscalation) {
    return 'high';
  }
  if (input.sharedCount === 2) {
    return 'medium';
  }
  return 'low';
}

export function deriveCrossPortfolioBlockingClusters(input: {
  crossPortfolioMissionIntelligenceSetId: string;
  portfolioSignals: CrossPortfolioPortfolioSignal[];
}): SystemicBlockingCluster[] {
  const signalsById = new Map(input.portfolioSignals.map((entry) => [entry.missionPortfolioId, entry]));
  const clusterToPortfolioIds = new Map<string, Set<string>>();

  for (const signal of input.portfolioSignals) {
    for (const blockingClusterId of signal.linkedBlockingClusterIds) {
      const set = clusterToPortfolioIds.get(blockingClusterId) ?? new Set<string>();
      set.add(signal.missionPortfolioId);
      clusterToPortfolioIds.set(blockingClusterId, set);
    }
  }

  return Array.from(clusterToPortfolioIds.entries())
    .map(([blockingClusterId, portfolioSet]) => {
      const portfolioIds = uniqueSortedStrings(Array.from(portfolioSet));
      if (portfolioIds.length < 2) {
        return null;
      }

      const memberSignals = portfolioIds
        .map((portfolioId) => signalsById.get(portfolioId))
        .filter((entry): entry is CrossPortfolioPortfolioSignal => entry !== undefined);
      const severity = deriveSeverity({
        portfolioSignals: memberSignals,
        sharedCount: portfolioIds.length,
      });
      const reasonTokens = uniqueSortedStrings([
        `shared_blocking_cluster:${blockingClusterId}`,
        `portfolio_count:${String(portfolioIds.length)}`,
        `severity:${severity}`,
      ]);

      return {
        systemicBlockingClusterId: deriveSystemicBlockingClusterId({
          crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
          portfolioIds,
          portfolioBlockingClusterIds: [blockingClusterId],
          severity,
          reasonTokens,
        }),
        crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
        portfolioIds,
        portfolioBlockingClusterIds: [blockingClusterId],
        severity,
        reasonTokens,
        state: 'active',
      } satisfies SystemicBlockingCluster;
    })
    .filter((entry): entry is SystemicBlockingCluster => entry !== null)
    .sort((left, right) => left.systemicBlockingClusterId.localeCompare(right.systemicBlockingClusterId));
}
