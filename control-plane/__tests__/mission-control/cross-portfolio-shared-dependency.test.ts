import { describe, expect, it } from 'vitest';

import { deriveCrossPortfolioSharedDependencies } from '../../mission-control/cross-portfolio-shared-dependency.ts';
import type { CrossPortfolioPortfolioSignal } from '../../mission-control/cross-portfolio-mission-intelligence-types.ts';

function signal(overrides: Partial<CrossPortfolioPortfolioSignal> = {}): CrossPortfolioPortfolioSignal {
  return {
    missionPortfolioId: 'portfolio-a',
    displayName: 'Portfolio A',
    readinessState: 'blocked',
    healthState: 'degraded',
    governancePosture: 'decision_blocked',
    linkedBlockingClusterIds: ['cluster-shared'],
    attentionStatus: 'awaiting_attention',
    attentionRequirementClasses: ['critical_blocking_cluster'],
    openEscalationClasses: ['portfolio_blocked'],
    openEscalationSeverities: ['high'],
    resolutionStatus: 'unresolved',
    closureEligibility: 'blocked_from_closure',
    closureState: 'under_resolution_review',
    resolutionOutcome: 'pending',
    criticalMissionCount: 1,
    highMissionCount: 1,
    reasonTokens: ['dependency:upstream_cluster'],
    ...overrides,
  };
}

describe('cross-portfolio shared dependency', () => {
  it('T-CPMI-SD1 detects dependency across portfolios', () => {
    const dependencies = deriveCrossPortfolioSharedDependencies({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      portfolioSignals: [
        signal({ missionPortfolioId: 'portfolio-a' }),
        signal({ missionPortfolioId: 'portfolio-b' }),
      ],
    });

    expect(dependencies.length).toBeGreaterThan(0);
    expect(dependencies.some((entry) => entry.portfolioIds.includes('portfolio-a') && entry.portfolioIds.includes('portfolio-b'))).toBe(true);
  });

  it('T-CPMI-SD2 unrelated dependencies are not merged', () => {
    const dependencies = deriveCrossPortfolioSharedDependencies({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      portfolioSignals: [
        signal({ missionPortfolioId: 'portfolio-a', linkedBlockingClusterIds: ['cluster-a'] }),
        signal({ missionPortfolioId: 'portfolio-b', linkedBlockingClusterIds: ['cluster-b'] }),
      ],
    });

    expect(dependencies.filter((entry) => entry.dependencyClass === 'shared_blocking_cluster')).toHaveLength(0);
  });
});
