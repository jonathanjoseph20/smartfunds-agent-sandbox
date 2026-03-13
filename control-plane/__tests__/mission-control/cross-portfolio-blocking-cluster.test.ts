import { describe, expect, it } from 'vitest';

import { deriveCrossPortfolioBlockingClusters } from '../../mission-control/cross-portfolio-blocking-cluster.ts';
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
    reasonTokens: [],
    ...overrides,
  };
}

describe('cross-portfolio blocking cluster', () => {
  it('T-CPMI-BC1 detects systemic cluster across shared cluster id', () => {
    const clusters = deriveCrossPortfolioBlockingClusters({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      portfolioSignals: [
        signal({ missionPortfolioId: 'portfolio-a' }),
        signal({ missionPortfolioId: 'portfolio-b' }),
      ],
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.portfolioIds).toEqual(['portfolio-a', 'portfolio-b']);
  });

  it('T-CPMI-BC2 severity derivation is stable for same input', () => {
    const one = deriveCrossPortfolioBlockingClusters({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      portfolioSignals: [
        signal({ missionPortfolioId: 'portfolio-a' }),
        signal({ missionPortfolioId: 'portfolio-b' }),
      ],
    });
    const two = deriveCrossPortfolioBlockingClusters({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      portfolioSignals: [
        signal({ missionPortfolioId: 'portfolio-a' }),
        signal({ missionPortfolioId: 'portfolio-b' }),
      ],
    });

    expect(two).toEqual(one);
    expect(two[0]?.severity).toBe(one[0]?.severity);
  });
});
