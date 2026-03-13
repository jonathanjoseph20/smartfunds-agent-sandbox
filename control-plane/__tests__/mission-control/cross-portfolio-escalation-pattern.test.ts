import { describe, expect, it } from 'vitest';

import { deriveCrossPortfolioEscalationPatterns } from '../../mission-control/cross-portfolio-escalation-pattern.ts';
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
    resolutionStatus: 'reopened',
    closureEligibility: 'blocked_from_closure',
    closureState: 'under_resolution_review',
    resolutionOutcome: 'reopened',
    criticalMissionCount: 1,
    highMissionCount: 1,
    reasonTokens: [],
    ...overrides,
  };
}

describe('cross-portfolio escalation pattern', () => {
  it('T-CPMI-EP1 detects repeated_blocking_escalation', () => {
    const patterns = deriveCrossPortfolioEscalationPatterns({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      portfolioSignals: [signal({ missionPortfolioId: 'portfolio-a' }), signal({ missionPortfolioId: 'portfolio-b' })],
    });

    expect(patterns.some((entry) => entry.patternClass === 'repeated_blocking_escalation')).toBe(true);
  });

  it('T-CPMI-EP2 detects repeated_governance_block and repeated_resolution_regression', () => {
    const patterns = deriveCrossPortfolioEscalationPatterns({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      portfolioSignals: [signal({ missionPortfolioId: 'portfolio-a' }), signal({ missionPortfolioId: 'portfolio-b' })],
    });

    expect(patterns.some((entry) => entry.patternClass === 'repeated_governance_block')).toBe(true);
    expect(patterns.some((entry) => entry.patternClass === 'repeated_resolution_regression')).toBe(true);
  });

  it('T-CPMI-EP3 detects systemic_inconclusive_pattern deterministically', () => {
    const patterns = deriveCrossPortfolioEscalationPatterns({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      portfolioSignals: [
        signal({ missionPortfolioId: 'portfolio-a', readinessState: 'inconclusive', healthState: 'inconclusive' }),
        signal({ missionPortfolioId: 'portfolio-b', readinessState: 'inconclusive', healthState: 'inconclusive' }),
      ],
    });

    expect(patterns.some((entry) => entry.patternClass === 'systemic_inconclusive_pattern')).toBe(true);
    expect(deriveCrossPortfolioEscalationPatterns({
      crossPortfolioMissionIntelligenceSetId: 'set-1',
      portfolioSignals: [
        signal({ missionPortfolioId: 'portfolio-a', readinessState: 'inconclusive', healthState: 'inconclusive' }),
        signal({ missionPortfolioId: 'portfolio-b', readinessState: 'inconclusive', healthState: 'inconclusive' }),
      ],
    })).toEqual(patterns);
  });
});
