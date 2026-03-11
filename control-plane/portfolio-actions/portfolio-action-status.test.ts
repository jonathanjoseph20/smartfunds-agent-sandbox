import { describe, expect, it } from 'vitest';

import { createPortfolioActionStatusProjection } from './portfolio-action-status.ts';

describe('portfolio-actions status projection', () => {
  it('T-PA-S1 classifies blocked readiness with escalate route', () => {
    const projection = createPortfolioActionStatusProjection({
      registry: {
        getActionDefinitions: () => [{
          actionId: 'reduce-risk-exposure',
          displayName: 'Reduce Risk Exposure',
          actionType: 'risk_reduction',
          enabled: true,
          portfolioMatchRules: {},
          readinessRules: ['min_linked_portfolios:1']
        }],
        getActionDefinitionById: () => ({
          actionId: 'reduce-risk-exposure',
          displayName: 'Reduce Risk Exposure',
          actionType: 'risk_reduction',
          enabled: true,
          portfolioMatchRules: {},
          readinessRules: ['min_linked_portfolios:1']
        })
      } as any,
      linker: {
        buildLinks: () => [{
          actionId: 'reduce-risk-exposure',
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
        }]
      } as any
    });

    const status = projection.projectOne('reduce-risk-exposure');
    expect(status.readinessState).toBe('blocked');
    expect(status.routeCategory).toBe('escalate');
    expect(status.priority).toBe('critical');
  });

  it('T-PA-S2 classifies ready status with review route', () => {
    const projection = createPortfolioActionStatusProjection({
      registry: {
        getActionDefinitions: () => [{
          actionId: 'review-governance-exposure',
          displayName: 'Review Governance Exposure',
          actionType: 'governance_review',
          enabled: true,
          portfolioMatchRules: {}
        }],
        getActionDefinitionById: () => ({
          actionId: 'review-governance-exposure',
          displayName: 'Review Governance Exposure',
          actionType: 'governance_review',
          enabled: true,
          portfolioMatchRules: {}
        })
      } as any,
      linker: {
        buildLinks: () => [{
          actionId: 'review-governance-exposure',
          linkedPortfolioIds: ['p1'],
          linkedPortfolios: [{
            portfolioId: 'p1',
            displayName: 'P1',
            portfolioType: 'governance',
            lifecycleState: 'active',
            readinessState: 'coherent',
            completionState: 'incomplete',
            blockingReasons: [],
            limitations: [],
            riskThemes: ['governance_risk_rising'],
            exposureFlags: ['event_exposure:governance'],
            concentrationWarnings: []
          }],
          riskThemes: [],
          exposureFlags: ['event_exposure:governance'],
          concentrationWarnings: [],
          rationale: ['p1:shared_market_event_family:governance']
        }]
      } as any
    });

    const status = projection.projectOne('review-governance-exposure');
    expect(status.readinessState).toBe('ready');
    expect(status.routeCategory).toBe('review');
    expect(status.priority).toBe('normal');
  });

  it('T-PA-S3 classifies high priority with prepare_allocation_review route', () => {
    const projection = createPortfolioActionStatusProjection({
      registry: {
        getActionDefinitions: () => [{
          actionId: 'monitor-liquidity-stress',
          displayName: 'Monitor Liquidity Stress',
          actionType: 'liquidity_monitoring',
          enabled: true,
          portfolioMatchRules: {}
        }],
        getActionDefinitionById: () => ({
          actionId: 'monitor-liquidity-stress',
          displayName: 'Monitor Liquidity Stress',
          actionType: 'liquidity_monitoring',
          enabled: true,
          portfolioMatchRules: {}
        })
      } as any,
      linker: {
        buildLinks: () => [{
          actionId: 'monitor-liquidity-stress',
          linkedPortfolioIds: ['p1'],
          linkedPortfolios: [{
            portfolioId: 'p1',
            displayName: 'P1',
            portfolioType: 'defi',
            lifecycleState: 'active',
            readinessState: 'coherent',
            completionState: 'incomplete',
            blockingReasons: [],
            limitations: [],
            riskThemes: ['liquidity_stress'],
            exposureFlags: ['event_exposure:liquidity'],
            concentrationWarnings: ['protocol_concentration:aave:2']
          }],
          riskThemes: ['liquidity_stress'],
          exposureFlags: ['event_exposure:liquidity'],
          concentrationWarnings: ['protocol_concentration:aave:2'],
          rationale: ['p1:shared_risk_theme:liquidity_stress']
        }]
      } as any
    });

    const status = projection.projectOne('monitor-liquidity-stress');
    expect(status.priority).toBe('high');
    expect(status.routeCategory).toBe('prepare_allocation_review');
  });
});
