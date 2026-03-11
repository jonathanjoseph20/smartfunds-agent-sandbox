import { describe, expect, it } from 'vitest';

import { evaluatePortfolioActionReadiness } from './portfolio-action-readiness.ts';

describe('portfolio-actions readiness', () => {
  const definition = {
    actionId: 'reduce-risk-exposure',
    displayName: 'Reduce Risk Exposure',
    actionType: 'risk_reduction',
    enabled: true,
    portfolioMatchRules: {},
    readinessRules: ['min_linked_portfolios:1']
  } as const;

  it('T-PA-RD1 classifies ready with coherent upstream support', () => {
    const readiness = evaluatePortfolioActionReadiness({
      definition,
      link: {
        actionId: definition.actionId,
        linkedPortfolioIds: ['p1'],
        linkedPortfolios: [{
          portfolioId: 'p1',
          displayName: 'P1',
          portfolioType: 'defi',
          lifecycleState: 'completed',
          readinessState: 'coherent',
          completionState: 'completed',
          blockingReasons: [],
          limitations: [],
          riskThemes: ['governance_risk_rising'],
          exposureFlags: ['event_exposure:governance'],
          concentrationWarnings: []
        }],
        riskThemes: ['governance_risk_rising'],
        exposureFlags: ['event_exposure:governance'],
        concentrationWarnings: [],
        rationale: ['p1:shared_risk_theme:governance_risk_rising']
      }
    });

    expect(readiness.readinessState).toBe('ready');
    expect(readiness.blockingReasons).toEqual([]);
  });

  it('T-PA-RD2 classifies blocked with explicit blockers', () => {
    const readiness = evaluatePortfolioActionReadiness({
      definition,
      link: {
        actionId: definition.actionId,
        linkedPortfolioIds: ['p1'],
        linkedPortfolios: [{
          portfolioId: 'p1',
          displayName: 'P1',
          portfolioType: 'defi',
          lifecycleState: 'stabilizing',
          readinessState: 'blocked',
          completionState: 'inconclusive',
          blockingReasons: ['linked_market_synthesis_conflict:p1'],
          limitations: ['market_conflict_detected'],
          riskThemes: ['governance_risk_rising'],
          exposureFlags: ['blocked_market_synthesis:m1'],
          concentrationWarnings: []
        }],
        riskThemes: ['governance_risk_rising'],
        exposureFlags: ['blocked_market_synthesis:m1'],
        concentrationWarnings: [],
        rationale: ['p1:shared_risk_theme:governance_risk_rising']
      }
    });

    expect(readiness.readinessState).toBe('blocked');
    expect(readiness.blockingReasons).toContain('blocked_portfolio_intelligence');
    expect(readiness.blockingReasons).toContain('unresolved_market_conflicts');
  });

  it('T-PA-RD3 classifies pending when no linked portfolios exist', () => {
    const readiness = evaluatePortfolioActionReadiness({
      definition,
      link: {
        actionId: definition.actionId,
        linkedPortfolioIds: [],
        linkedPortfolios: [],
        riskThemes: [],
        exposureFlags: [],
        concentrationWarnings: [],
        rationale: []
      }
    });

    expect(readiness.readinessState).toBe('pending');
    expect(readiness.limitations).toContain('insufficient_portfolio_coverage');
  });
});
