import { describe, expect, it } from 'vitest';

import { deriveCrossPortfolioMissionIntelligenceSetId } from '../../mission-control/cross-portfolio-mission-intelligence-identity.ts';
import { createCrossPortfolioMissionIntelligenceRegistry } from '../../mission-control/cross-portfolio-mission-intelligence-registry.ts';

describe('cross-portfolio mission intelligence registry', () => {
  it('T-CPMI-R1 deterministic set identity is stable', () => {
    const one = deriveCrossPortfolioMissionIntelligenceSetId({
      setType: 'systemic_blocking_set',
      portfolioIds: ['portfolio-b', 'portfolio-a'],
    });
    const two = deriveCrossPortfolioMissionIntelligenceSetId({
      setType: 'systemic_blocking_set',
      portfolioIds: ['portfolio-a', 'portfolio-b'],
    });

    expect(two).toBe(one);
  });

  it('T-CPMI-R2 membership normalization sorts and dedupes', () => {
    const registry = createCrossPortfolioMissionIntelligenceRegistry();

    expect(registry.normalizePortfolioMembership({
      portfolioIds: ['portfolio-b', 'portfolio-a', 'portfolio-a', ''],
    })).toEqual(['portfolio-a', 'portfolio-b']);
  });

  it('T-CPMI-R3 dedupeIntelligenceSets removes semantic duplicates', () => {
    const registry = createCrossPortfolioMissionIntelligenceRegistry();
    const deduped = registry.dedupeIntelligenceSets({
      sets: [
        { setType: 'systemic_blocking_set', portfolioIds: ['portfolio-a', 'portfolio-b'] },
        { setType: 'systemic_blocking_set', portfolioIds: ['portfolio-b', 'portfolio-a'] },
      ],
    });

    expect(deduped).toHaveLength(1);
    expect(deduped[0]?.portfolioIds).toEqual(['portfolio-a', 'portfolio-b']);
  });
});
