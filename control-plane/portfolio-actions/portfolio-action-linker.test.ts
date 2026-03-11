import { describe, expect, it } from 'vitest';

import { createPortfolioActionLinker } from './portfolio-action-linker.ts';

describe('portfolio-actions linker', () => {
  it('T-PA-L1 links by explicit rules and shared risk themes', () => {
    const linker = createPortfolioActionLinker({
      registry: {
        getActionDefinitions: () => [{
          actionId: 'reduce-risk-exposure',
          displayName: 'Reduce Risk Exposure',
          actionType: 'risk_reduction',
          enabled: true,
          portfolioMatchRules: {
            riskThemes: ['governance_risk_rising'],
            marketEventFamilies: ['governance']
          }
        }],
        getActionDefinitionById: () => { throw new Error('unused'); }
      } as any,
      portfolioInspection: {
        listPortfolioIntelligenceUnits: () => [{
          portfolioId: 'governance-sensitive-portfolio',
          displayName: 'Governance Portfolio',
          portfolioType: 'governance',
          enabled: true
        }],
        inspectPortfolioIntelligence: () => ({
          portfolioId: 'governance-sensitive-portfolio',
          displayName: 'Governance Portfolio',
          portfolioType: 'governance',
          enabled: true,
          lifecycleState: 'progressing',
          readinessState: 'analyzing',
          completionState: 'incomplete',
          linkedMarketSynthesisIds: ['m1'],
          linkedMarketSyntheses: [],
          blockingReasons: [],
          strengths: [],
          limitations: [],
          rationale: [],
          riskThemes: ['governance_risk_rising'],
          exposureFlags: ['event_exposure:governance'],
          concentrationWarnings: []
        })
      } as any
    });

    const links = linker.buildLinks();
    expect(links[0]?.linkedPortfolioIds).toEqual(['governance-sensitive-portfolio']);
    expect(links[0]?.rationale).toContain('governance-sensitive-portfolio:shared_risk_theme:governance_risk_rising');
    expect(links[0]?.rationale).toContain('governance-sensitive-portfolio:shared_market_event_family:governance');
  });

  it('T-PA-L2 excludes unrelated portfolios', () => {
    const linker = createPortfolioActionLinker({
      registry: {
        getActionDefinitions: () => [{
          actionId: 'monitor-liquidity-stress',
          displayName: 'Monitor Liquidity Stress',
          actionType: 'liquidity_monitoring',
          enabled: true,
          portfolioMatchRules: {
            riskThemes: ['liquidity_stress']
          }
        }],
        getActionDefinitionById: () => { throw new Error('unused'); }
      } as any,
      portfolioInspection: {
        listPortfolioIntelligenceUnits: () => [{
          portfolioId: 'yield-sensitive-portfolio',
          displayName: 'Yield Portfolio',
          portfolioType: 'yield',
          enabled: true
        }],
        inspectPortfolioIntelligence: () => ({
          portfolioId: 'yield-sensitive-portfolio',
          displayName: 'Yield Portfolio',
          portfolioType: 'yield',
          enabled: true,
          lifecycleState: 'active',
          readinessState: 'analyzing',
          completionState: 'incomplete',
          linkedMarketSynthesisIds: ['m1'],
          linkedMarketSyntheses: [],
          blockingReasons: [],
          strengths: [],
          limitations: [],
          rationale: [],
          riskThemes: ['yield_instability'],
          exposureFlags: ['event_exposure:yield'],
          concentrationWarnings: []
        })
      } as any
    });

    const links = linker.buildLinks();
    expect(links[0]?.linkedPortfolioIds).toEqual([]);
  });

  it('T-PA-L3 rationale ordering is deterministic', () => {
    const linker = createPortfolioActionLinker({
      registry: {
        getActionDefinitions: () => [{
          actionId: 'review-governance-exposure',
          displayName: 'Review Governance',
          actionType: 'governance_review',
          enabled: true,
          portfolioMatchRules: {
            riskThemes: ['governance_risk_rising'],
            concentrationWarnings: ['protocol_concentration']
          }
        }],
        getActionDefinitionById: () => { throw new Error('unused'); }
      } as any,
      portfolioInspection: {
        listPortfolioIntelligenceUnits: () => [{
          portfolioId: 'governance-sensitive-portfolio',
          displayName: 'Governance Portfolio',
          portfolioType: 'governance',
          enabled: true
        }],
        inspectPortfolioIntelligence: () => ({
          portfolioId: 'governance-sensitive-portfolio',
          displayName: 'Governance Portfolio',
          portfolioType: 'governance',
          enabled: true,
          lifecycleState: 'active',
          readinessState: 'coherent',
          completionState: 'completed',
          linkedMarketSynthesisIds: ['m1'],
          linkedMarketSyntheses: [],
          blockingReasons: [],
          strengths: [],
          limitations: [],
          rationale: [],
          riskThemes: ['governance_risk_rising'],
          exposureFlags: [],
          concentrationWarnings: ['protocol_concentration:aave:2']
        })
      } as any
    });

    const [link] = linker.buildLinks();
    expect(link?.rationale).toEqual([
      'governance-sensitive-portfolio:explicit_definition_match:governance',
      'governance-sensitive-portfolio:shared_concentration_warning:protocol_concentration:aave:2',
      'governance-sensitive-portfolio:shared_risk_theme:governance_risk_rising'
    ]);
  });
});
