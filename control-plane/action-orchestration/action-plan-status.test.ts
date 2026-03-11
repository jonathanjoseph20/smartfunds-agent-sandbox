import { describe, expect, it } from 'vitest';

import { createActionPlanStatusProjection } from './action-plan-status.ts';

describe('action-orchestration status projection', () => {
  it('T-AO-S1 classifies blocked conflict-heavy path', () => {
    const projection = createActionPlanStatusProjection({
      registry: {
        getActionPlanDefinitions: () => [{
          actionPlanId: 'risk-reduction-plan',
          displayName: 'Risk Reduction Plan',
          planType: 'risk_reduction',
          enabled: true,
          matchingRules: {},
        }],
        getActionPlanDefinitionById: () => ({
          actionPlanId: 'risk-reduction-plan',
          displayName: 'Risk Reduction Plan',
          planType: 'risk_reduction',
          enabled: true,
          matchingRules: {},
        }),
      } as any,
      linker: {
        buildLinks: () => [{
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
            blockingReasons: ['contradictory_exposure_signals'],
            strengths: [],
            limitations: ['completion_inconclusive'],
          }],
          riskThemes: ['liquidity_stress'],
          routeCategories: ['escalate', 'review'],
          rationale: ['a1:shared_risk_theme:liquidity_stress'],
        }],
      } as any,
    });

    const status = projection.projectOne('risk-reduction-plan');
    expect(status.readinessState).toBe('blocked');
    expect(status.completionState).toBe('inconclusive');
    expect(status.priority).toBe('critical');
    expect(status.routeSummary).toBe('escalate_bundle');
  });

  it('T-AO-S2 classifies coherent path', () => {
    const projection = createActionPlanStatusProjection({
      registry: {
        getActionPlanDefinitions: () => [{
          actionPlanId: 'governance-review-plan',
          displayName: 'Governance Review Plan',
          planType: 'governance_review',
          enabled: true,
          matchingRules: {},
        }],
        getActionPlanDefinitionById: () => ({
          actionPlanId: 'governance-review-plan',
          displayName: 'Governance Review Plan',
          planType: 'governance_review',
          enabled: true,
          matchingRules: {},
        }),
      } as any,
      linker: {
        buildLinks: () => [{
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
          rationale: ['a1:shared_risk_theme:governance_risk_rising'],
        }],
      } as any,
    });

    const status = projection.projectOne('governance-review-plan');
    expect(status.readinessState).toBe('coherent');
    expect(status.routeSummary).toBe('review_bundle');
    expect(status.priority).toBe('normal');
  });

  it('T-AO-S3 classifies completed intelligence state', () => {
    const projection = createActionPlanStatusProjection({
      registry: {
        getActionPlanDefinitions: () => [{
          actionPlanId: 'liquidity-defense-plan',
          displayName: 'Liquidity Defense Plan',
          planType: 'liquidity_defense',
          enabled: true,
          matchingRules: {},
        }],
        getActionPlanDefinitionById: () => ({
          actionPlanId: 'liquidity-defense-plan',
          displayName: 'Liquidity Defense Plan',
          planType: 'liquidity_defense',
          enabled: true,
          matchingRules: {},
        }),
      } as any,
      linker: {
        buildLinks: () => [{
          actionPlanId: 'liquidity-defense-plan',
          linkedActionIds: ['a1'],
          linkedActions: [{
            actionId: 'a1',
            displayName: 'A1',
            actionType: 'liquidity_monitoring',
            enabled: true,
            lifecycleState: 'completed',
            readinessState: 'coherent',
            completionState: 'completed',
            priority: 'high',
            routeCategory: 'prepare_allocation_review',
            riskThemes: ['liquidity_stress'],
            blockingReasons: [],
            strengths: [],
            limitations: [],
          }],
          riskThemes: ['liquidity_stress'],
          routeCategories: ['prepare_allocation_review'],
          rationale: ['a1:matching_route_category:prepare_allocation_review'],
        }],
      } as any,
    });

    const status = projection.projectOne('liquidity-defense-plan');
    expect(status.completionState).toBe('completed');
    expect(status.lifecycleState).toBe('completed');
    expect(status.routeSummary).toBe('allocation_review_bundle');
  });
});
