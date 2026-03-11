import { describe, expect, it } from 'vitest';

import { createPortfolioStatusProjection } from './portfolio-status.ts';

describe('portfolio-intelligence status projection', () => {
  it('T-PI-S1 classifies blocked readiness when linked blockers exist', () => {
    const projection = createPortfolioStatusProjection({
      registry: {
        listPortfolioDefinitions: () => [{
          portfolioId: 'defi-core-portfolio',
          displayName: 'DeFi Core',
          portfolioType: 'defi',
          enabled: true,
          matchingRules: {},
          readinessRules: { requireAllLinkedSynthesesReady: true }
        }],
        getPortfolioDefinition: () => ({
          portfolioId: 'defi-core-portfolio',
          displayName: 'DeFi Core',
          portfolioType: 'defi',
          enabled: true,
          matchingRules: {},
          readinessRules: { requireAllLinkedSynthesesReady: true }
        })
      } as any,
      linker: {
        buildLinks: () => [{
          portfolioId: 'defi-core-portfolio',
          linkedMarketSynthesisIds: ['m1'],
          rationale: [],
          linkedMarketSyntheses: [{
            marketSynthesisId: 'm1',
            displayName: 'M1',
            synthesisType: 'market_risk',
            lifecycleState: 'stabilizing',
            readinessState: 'blocked',
            completionState: 'inconclusive',
            blockingReasons: ['linked_cross_swarm_blocked:m1'],
            limitations: ['lim1'],
            rationale: [],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: []
          }]
        }]
      } as any
    });

    const status = projection.projectOne('defi-core-portfolio');
    expect(status.readinessState).toBe('blocked');
    expect(status.completionState).toBe('inconclusive');
  });

  it('T-PI-S2 classifies coherent and completed when all linked syntheses are complete and coherent', () => {
    const projection = createPortfolioStatusProjection({
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
            synthesisType: 'market_risk',
            lifecycleState: 'completed',
            readinessState: 'coherent',
            completionState: 'completed',
            blockingReasons: [],
            limitations: [],
            rationale: [],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: []
          }, {
            marketSynthesisId: 'm2',
            displayName: 'M2',
            synthesisType: 'liquidity_stress',
            lifecycleState: 'completed',
            readinessState: 'coherent',
            completionState: 'completed',
            blockingReasons: [],
            limitations: [],
            rationale: [],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: []
          }]
        }]
      } as any
    });

    const status = projection.projectOne('defi-core-portfolio');
    expect(status.readinessState).toBe('coherent');
    expect(status.completionState).toBe('completed');
    expect(status.lifecycleState).toBe('completed');
  });

  it('T-PI-S3 keeps incomplete when syntheses are still analyzing without explicit blockers', () => {
    const projection = createPortfolioStatusProjection({
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
          linkedMarketSynthesisIds: ['m1'],
          rationale: [],
          linkedMarketSyntheses: [{
            marketSynthesisId: 'm1',
            displayName: 'M1',
            synthesisType: 'market_risk',
            lifecycleState: 'progressing',
            readinessState: 'analyzing',
            completionState: 'incomplete',
            blockingReasons: [],
            limitations: [],
            rationale: [],
            protocolFamilies: [],
            assetFamilies: [],
            eventFamilies: []
          }]
        }]
      } as any
    });

    const status = projection.projectOne('defi-core-portfolio');
    expect(status.readinessState).toBe('analyzing');
    expect(status.completionState).toBe('incomplete');
  });
});
