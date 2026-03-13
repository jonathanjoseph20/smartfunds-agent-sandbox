import {
  deriveCrossPortfolioSharedDependencyId,
  uniqueSortedStrings,
} from './cross-portfolio-mission-intelligence-identity.ts';
import type {
  CrossPortfolioPortfolioSignal,
  CrossPortfolioSharedDependencyClass,
  CrossPortfolioSharedDependencySurface,
} from './cross-portfolio-mission-intelligence-types.ts';

type DependencyBucket = {
  portfolioIds: Set<string>;
  reasonTokens: Set<string>;
};

function dependencyClassForKey(key: string): CrossPortfolioSharedDependencyClass {
  if (key.startsWith('shared_blocking_cluster:')) {
    return 'shared_blocking_cluster';
  }
  if (key.startsWith('shared_governance_dependency:')) {
    return 'shared_governance_dependency';
  }
  if (key.startsWith('shared_attention_dependency:')) {
    return 'shared_attention_dependency';
  }
  if (key.startsWith('shared_resolution_dependency:')) {
    return 'shared_resolution_dependency';
  }
  return 'shared_upstream_mission_dependency';
}

function collectDependencyKeys(signal: CrossPortfolioPortfolioSignal): string[] {
  const keys: string[] = [];

  for (const clusterId of signal.linkedBlockingClusterIds) {
    keys.push(`shared_blocking_cluster:${clusterId}`);
  }

  for (const requirementClass of signal.attentionRequirementClasses) {
    keys.push(`shared_attention_dependency:${requirementClass}`);
  }

  if (signal.governancePosture === 'decision_blocked' || signal.governancePosture === 'deferred' || signal.governancePosture === 'mixed') {
    keys.push(`shared_governance_dependency:${signal.governancePosture}`);
  }

  if (
    signal.resolutionStatus !== 'resolved'
    || signal.closureEligibility === 'blocked_from_closure'
    || signal.closureState === 'under_resolution_review'
  ) {
    keys.push(`shared_resolution_dependency:${signal.resolutionStatus}:${signal.closureEligibility}:${signal.closureState}`);
  }

  for (const token of signal.reasonTokens) {
    if (token.includes('dependency') || token.includes('blocking')) {
      keys.push(`shared_upstream_mission_dependency:${token}`);
    }
  }

  return uniqueSortedStrings(keys);
}

export function deriveCrossPortfolioSharedDependencies(input: {
  crossPortfolioMissionIntelligenceSetId: string;
  portfolioSignals: CrossPortfolioPortfolioSignal[];
}): CrossPortfolioSharedDependencySurface[] {
  const buckets = new Map<string, DependencyBucket>();

  for (const signal of input.portfolioSignals) {
    for (const key of collectDependencyKeys(signal)) {
      const bucket = buckets.get(key) ?? {
        portfolioIds: new Set<string>(),
        reasonTokens: new Set<string>(),
      };

      bucket.portfolioIds.add(signal.missionPortfolioId);
      bucket.reasonTokens.add(`dependency_key:${key}`);
      bucket.reasonTokens.add(`portfolio:${signal.missionPortfolioId}`);
      buckets.set(key, bucket);
    }
  }

  return Array.from(buckets.entries())
    .map(([key, bucket]) => {
      const portfolioIds = uniqueSortedStrings(Array.from(bucket.portfolioIds));
      if (portfolioIds.length < 2) {
        return null;
      }

      const dependencyClass = dependencyClassForKey(key);
      const reasonTokens = uniqueSortedStrings([
        `dependency_class:${dependencyClass}`,
        `portfolio_count:${String(portfolioIds.length)}`,
        ...Array.from(bucket.reasonTokens),
      ]);

      return {
        crossPortfolioSharedDependencyId: deriveCrossPortfolioSharedDependencyId({
          crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
          portfolioIds,
          dependencyClass,
          reasonTokens,
        }),
        crossPortfolioMissionIntelligenceSetId: input.crossPortfolioMissionIntelligenceSetId,
        portfolioIds,
        dependencyClass,
        reasonTokens,
        state: 'active',
      } satisfies CrossPortfolioSharedDependencySurface;
    })
    .filter((entry): entry is CrossPortfolioSharedDependencySurface => entry !== null)
    .sort((left, right) => left.crossPortfolioSharedDependencyId.localeCompare(right.crossPortfolioSharedDependencyId));
}
