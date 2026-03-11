import { describe, expect, it } from 'vitest';

import { evaluatePortfolioActionCompletion } from './portfolio-action-completion.ts';

describe('portfolio-actions completion', () => {
  const definition = {
    actionId: 'review-yield-instability',
    displayName: 'Review Yield Instability',
    actionType: 'yield_review',
    enabled: true,
    portfolioMatchRules: {}
  } as const;

  it('T-PA-C1 classifies completed when readiness is ready and upstream complete', () => {
    const completion = evaluatePortfolioActionCompletion({
      definition,
      readiness: {
        actionId: definition.actionId,
        readinessState: 'ready',
        blockingReasons: [],
        strengths: [],
        limitations: []
      },
      link: {
        actionId: definition.actionId,
        linkedPortfolioIds: ['p1'],
        linkedPortfolios: [{
          portfolioId: 'p1',
          displayName: 'P1',
          portfolioType: 'yield',
          lifecycleState: 'completed',
          readinessState: 'coherent',
          completionState: 'completed',
          blockingReasons: [],
          limitations: [],
          riskThemes: [],
          exposureFlags: [],
          concentrationWarnings: []
        }],
        riskThemes: [],
        exposureFlags: [],
        concentrationWarnings: [],
        rationale: []
      }
    });

    expect(completion.completionState).toBe('completed');
  });

  it('T-PA-C2 classifies inconclusive when readiness is blocked', () => {
    const completion = evaluatePortfolioActionCompletion({
      definition,
      readiness: {
        actionId: definition.actionId,
        readinessState: 'blocked',
        blockingReasons: ['blocked_portfolio_intelligence'],
        strengths: [],
        limitations: []
      },
      link: {
        actionId: definition.actionId,
        linkedPortfolioIds: ['p1'],
        linkedPortfolios: [],
        riskThemes: [],
        exposureFlags: [],
        concentrationWarnings: [],
        rationale: []
      }
    });

    expect(completion.completionState).toBe('inconclusive');
    expect(completion.limitations).toContain('blocked_portfolio_intelligence');
  });

  it('T-PA-C3 classifies incomplete while upstream is still progressing', () => {
    const completion = evaluatePortfolioActionCompletion({
      definition,
      readiness: {
        actionId: definition.actionId,
        readinessState: 'analyzing',
        blockingReasons: [],
        strengths: [],
        limitations: []
      },
      link: {
        actionId: definition.actionId,
        linkedPortfolioIds: ['p1'],
        linkedPortfolios: [{
          portfolioId: 'p1',
          displayName: 'P1',
          portfolioType: 'yield',
          lifecycleState: 'progressing',
          readinessState: 'analyzing',
          completionState: 'incomplete',
          blockingReasons: [],
          limitations: [],
          riskThemes: [],
          exposureFlags: [],
          concentrationWarnings: []
        }],
        riskThemes: [],
        exposureFlags: [],
        concentrationWarnings: [],
        rationale: []
      }
    });

    expect(completion.completionState).toBe('incomplete');
  });
});
