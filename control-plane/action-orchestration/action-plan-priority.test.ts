import { describe, expect, it } from 'vitest';

import { evaluateActionPlanPriority } from './action-plan-priority.ts';

describe('action-orchestration priority', () => {
  it('T-AO-P1 emits critical for blocked critical components', () => {
    const result = evaluateActionPlanPriority({
      actionPlanId: 'risk-reduction-plan',
      link: {
        actionPlanId: 'risk-reduction-plan',
        linkedActionIds: ['a1'],
        linkedActions: [{
          actionId: 'a1',
          displayName: 'A1',
          actionType: 'risk_reduction',
          enabled: true,
          lifecycleState: 'stabilizing',
          readinessState: 'blocked',
          completionState: 'inconclusive',
          priority: 'critical',
          routeCategory: 'escalate',
          riskThemes: ['liquidity_stress'],
          blockingReasons: ['unresolved_market_conflicts'],
          strengths: [],
          limitations: [],
        }],
        riskThemes: ['liquidity_stress'],
        routeCategories: ['escalate'],
        rationale: [],
      },
      readinessState: 'blocked',
      completionState: 'inconclusive',
    });

    expect(result.priority).toBe('critical');
  });

  it('T-AO-P2 emits high for inconclusive non-critical path', () => {
    const result = evaluateActionPlanPriority({
      actionPlanId: 'yield-instability-plan',
      link: {
        actionPlanId: 'yield-instability-plan',
        linkedActionIds: ['a1'],
        linkedActions: [{
          actionId: 'a1',
          displayName: 'A1',
          actionType: 'yield_review',
          enabled: true,
          lifecycleState: 'active',
          readinessState: 'analyzing',
          completionState: 'incomplete',
          priority: 'normal',
          routeCategory: 'review',
          riskThemes: ['yield_instability'],
          blockingReasons: [],
          strengths: [],
          limitations: [],
        }],
        riskThemes: ['yield_instability'],
        routeCategories: ['review'],
        rationale: [],
      },
      readinessState: 'analyzing',
      completionState: 'inconclusive',
    });

    expect(result.priority).toBe('high');
  });

  it('T-AO-P3 emits normal on baseline coherent path', () => {
    const result = evaluateActionPlanPriority({
      actionPlanId: 'governance-review-plan',
      link: {
        actionPlanId: 'governance-review-plan',
        linkedActionIds: ['a1'],
        linkedActions: [{
          actionId: 'a1',
          displayName: 'A1',
          actionType: 'governance_review',
          enabled: true,
          lifecycleState: 'active',
          readinessState: 'coherent',
          completionState: 'incomplete',
          priority: 'normal',
          routeCategory: 'review',
          riskThemes: ['governance_risk_rising'],
          blockingReasons: [],
          strengths: [],
          limitations: [],
        }],
        riskThemes: ['governance_risk_rising'],
        routeCategories: ['review'],
        rationale: [],
      },
      readinessState: 'coherent',
      completionState: 'incomplete',
    });

    expect(result.priority).toBe('normal');
  });
});
