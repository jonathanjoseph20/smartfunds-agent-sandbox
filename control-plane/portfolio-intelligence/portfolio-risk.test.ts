import { describe, expect, it } from 'vitest';

import { createPortfolioRiskAggregator } from './portfolio-risk.ts';

describe('portfolio-intelligence risk aggregator', () => {
  it('T-PI-K1 aggregates deterministic themes and flags', () => {
    const aggregator = createPortfolioRiskAggregator({
      registry: {
        listPortfolioDefinitions: () => [{
          portfolioId: 'defi-core-portfolio',
          displayName: 'DeFi Core',
          portfolioType: 'defi',
          enabled: true,
          matchingRules: {}
        }],
        getPortfolioDefinition: () => ({
          portfolioId: 'defi-core-portfolio',
          displayName: 'DeFi Core',
          portfolioType: 'defi',
          enabled: true,
          matchingRules: {}
        })
      } as any,
      linker: {
        buildLinks: () => [{
          portfolioId: 'defi-core-portfolio',
          linkedMarketSynthesisIds: ['m1', 'm2'],
          rationale: [],
          linkedMarketSyntheses: [{
            marketSynthesisId: 'm1',
            displayName: 'M1',
            synthesisType: 'governance_instability',
            lifecycleState: 'stabilizing',
            readinessState: 'blocked',
            completionState: 'inconclusive',
            blockingReasons: ['governance_blocker'],
            limitations: ['governance_limit'],
            rationale: ['shared_event_family:governance'],
            protocolFamilies: ['aave'],
            assetFamilies: ['eth'],
            eventFamilies: ['governance']
          }, {
            marketSynthesisId: 'm2',
            displayName: 'M2',
            synthesisType: 'liquidity_stress',
            lifecycleState: 'progressing',
            readinessState: 'analyzing',
            completionState: 'incomplete',
            blockingReasons: [],
            limitations: ['yield_instability_signal'],
            rationale: ['shared_event_family:liquidity'],
            protocolFamilies: ['aave'],
            assetFamilies: ['stablecoin'],
            eventFamilies: ['liquidity', 'yield']
          }]
        }]
      } as any
    });

    const risk = aggregator.aggregateOne('defi-core-portfolio');

    expect(risk.riskThemes).toEqual([
      'governance_risk_rising',
      'liquidity_stress',
      'protocol_exposure_pressure',
      'yield_instability'
    ]);
    expect(risk.exposureFlags).toContain('blocked_market_synthesis:m1');
    expect(risk.exposureFlags).toContain('protocol_exposure:aave');
    expect(risk.concentrationWarnings).toContain('protocol_concentration:aave:2');
  });
});
