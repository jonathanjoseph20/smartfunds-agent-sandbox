import { describe, expect, it } from 'vitest';

import { createPortfolioLinker } from './portfolio-linker.ts';

describe('portfolio-intelligence linker', () => {
  it('T-PI-L1 links syntheses with explicit and shared family rationale', () => {
    const linker = createPortfolioLinker({
      registry: {
        listPortfolioDefinitions: () => [{
          portfolioId: 'defi-core-portfolio',
          displayName: 'DeFi Core',
          portfolioType: 'defi',
          enabled: true,
          matchingRules: {
            protocolFamilies: ['aave'],
            eventFamilies: ['market']
          }
        }],
        getPortfolioDefinition: () => { throw new Error('unused'); }
      } as any,
      marketInspection: {
        listMarketSyntheses: () => [{ marketSynthesisId: 'market-risk-synthesis', displayName: 'Market Risk', synthesisType: 'market_risk', enabled: true }],
        inspectMarketSynthesis: () => ({
          marketSynthesisId: 'market-risk-synthesis',
          displayName: 'Market Risk',
          synthesisType: 'market_risk',
          lifecycleState: 'progressing',
          readinessState: 'analyzing',
          completionState: 'incomplete',
          linkedCrossSwarms: [{
            protocolFamilies: ['aave'],
            assetFamilies: ['eth'],
            eventFamilies: ['market']
          }],
          blockingReasons: [],
          limitations: [],
          rationale: []
        })
      } as any
    });

    const links = linker.buildLinks();

    expect(links[0]?.linkedMarketSynthesisIds).toEqual(['market-risk-synthesis']);
    expect(links[0]?.rationale).toContain('market-risk-synthesis:shared_protocol_family:aave');
    expect(links[0]?.rationale).toContain('market-risk-synthesis:shared_event_family:market');
  });

  it('T-PI-L2 excludes non-matching market syntheses', () => {
    const linker = createPortfolioLinker({
      registry: {
        listPortfolioDefinitions: () => [{
          portfolioId: 'governance-sensitive-portfolio',
          displayName: 'Governance',
          portfolioType: 'governance',
          enabled: true,
          matchingRules: {
            eventFamilies: ['governance']
          }
        }],
        getPortfolioDefinition: () => { throw new Error('unused'); }
      } as any,
      marketInspection: {
        listMarketSyntheses: () => [{ marketSynthesisId: 'liquidity-stress-market-synthesis', displayName: 'Liquidity', synthesisType: 'liquidity_stress', enabled: true }],
        inspectMarketSynthesis: () => ({
          marketSynthesisId: 'liquidity-stress-market-synthesis',
          displayName: 'Liquidity',
          synthesisType: 'liquidity_stress',
          lifecycleState: 'active',
          readinessState: 'analyzing',
          completionState: 'incomplete',
          linkedCrossSwarms: [{
            protocolFamilies: ['curve'],
            assetFamilies: ['stablecoin'],
            eventFamilies: ['liquidity']
          }],
          blockingReasons: [],
          limitations: [],
          rationale: []
        })
      } as any
    });

    const links = linker.buildLinks();
    expect(links[0]?.linkedMarketSynthesisIds).toEqual([]);
  });

  it('T-PI-L3 supports explicit synthesis type matching', () => {
    const linker = createPortfolioLinker({
      registry: {
        listPortfolioDefinitions: () => [{
          portfolioId: 'yield-sensitive-portfolio',
          displayName: 'Yield',
          portfolioType: 'yield',
          enabled: true,
          matchingRules: {
            synthesisTypes: ['yield_instability']
          }
        }],
        getPortfolioDefinition: () => { throw new Error('unused'); }
      } as any,
      marketInspection: {
        listMarketSyntheses: () => [{ marketSynthesisId: 'yield-instability-market-synthesis', displayName: 'Yield', synthesisType: 'yield_instability', enabled: true }],
        inspectMarketSynthesis: () => ({
          marketSynthesisId: 'yield-instability-market-synthesis',
          displayName: 'Yield',
          synthesisType: 'yield_instability',
          lifecycleState: 'completed',
          readinessState: 'coherent',
          completionState: 'completed',
          linkedCrossSwarms: [],
          blockingReasons: [],
          limitations: [],
          rationale: []
        })
      } as any
    });

    const links = linker.buildLinks();
    expect(links[0]?.linkedMarketSynthesisIds).toEqual(['yield-instability-market-synthesis']);
    expect(links[0]?.rationale).toContain('yield-instability-market-synthesis:explicit_definition_match:yield_instability');
  });
});
