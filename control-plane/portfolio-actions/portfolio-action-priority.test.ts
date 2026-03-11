import { describe, expect, it } from 'vitest';

import { evaluatePortfolioActionPriority } from './portfolio-action-priority.ts';

describe('portfolio-actions priority', () => {
  const definition = {
    actionId: 'monitor-liquidity-stress',
    displayName: 'Monitor Liquidity Stress',
    actionType: 'liquidity_monitoring',
    enabled: true,
    portfolioMatchRules: {}
  } as const;

  it('T-PA-P1 classifies critical on unresolved conflicts', () => {
    const priority = evaluatePortfolioActionPriority({
      definition,
      link: {
        actionId: definition.actionId,
        linkedPortfolioIds: ['p1'],
        linkedPortfolios: [],
        riskThemes: ['liquidity_stress'],
        exposureFlags: [],
        concentrationWarnings: [],
        rationale: []
      },
      readiness: {
        actionId: definition.actionId,
        readinessState: 'blocked',
        blockingReasons: ['unresolved_market_conflicts'],
        strengths: [],
        limitations: []
      },
      completion: {
        actionId: definition.actionId,
        completionState: 'inconclusive',
        limitations: []
      }
    });

    expect(priority.priority).toBe('critical');
    expect(priority.routeCategory).toBe('escalate');
  });

  it('T-PA-P2 classifies high for concentration warnings', () => {
    const priority = evaluatePortfolioActionPriority({
      definition,
      link: {
        actionId: definition.actionId,
        linkedPortfolioIds: ['p1'],
        linkedPortfolios: [],
        riskThemes: ['liquidity_stress'],
        exposureFlags: [],
        concentrationWarnings: ['protocol_concentration:aave:2'],
        rationale: []
      },
      readiness: {
        actionId: definition.actionId,
        readinessState: 'ready',
        blockingReasons: [],
        strengths: [],
        limitations: []
      },
      completion: {
        actionId: definition.actionId,
        completionState: 'incomplete',
        limitations: []
      }
    });

    expect(priority.priority).toBe('high');
    expect(priority.routeCategory).toBe('prepare_allocation_review');
  });

  it('T-PA-P3 classifies normal in analyzing state without escalators', () => {
    const priority = evaluatePortfolioActionPriority({
      definition,
      link: {
        actionId: definition.actionId,
        linkedPortfolioIds: ['p1'],
        linkedPortfolios: [],
        riskThemes: [],
        exposureFlags: [],
        concentrationWarnings: [],
        rationale: []
      },
      readiness: {
        actionId: definition.actionId,
        readinessState: 'analyzing',
        blockingReasons: [],
        strengths: [],
        limitations: []
      },
      completion: {
        actionId: definition.actionId,
        completionState: 'incomplete',
        limitations: []
      }
    });

    expect(priority.priority).toBe('normal');
    expect(priority.routeCategory).toBe('review');
  });
});
