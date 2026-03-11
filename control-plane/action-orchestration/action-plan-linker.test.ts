import { describe, expect, it } from 'vitest';

import { createActionPlanLinker } from './action-plan-linker.ts';

describe('action-orchestration linker', () => {
  it('T-AO-L1 links by explicit rules and shared risk themes', () => {
    const linker = createActionPlanLinker({
      registry: {
        getActionPlanDefinitions: () => [{
          actionPlanId: 'governance-review-plan',
          displayName: 'Governance Plan',
          planType: 'governance_review',
          enabled: true,
          matchingRules: {
            routeCategories: ['review'],
            riskThemes: ['governance_risk_rising'],
          }
        }],
        getActionPlanDefinitionById: () => { throw new Error('unused'); }
      } as any,
      portfolioActionInspection: {
        listPortfolioActions: () => [{
          actionId: 'review-governance-exposure',
          displayName: 'Review Governance Exposure',
          actionType: 'governance_review',
          enabled: true,
        }],
        inspectPortfolioAction: () => ({
          actionId: 'review-governance-exposure',
          displayName: 'Review Governance Exposure',
          actionType: 'governance_review',
          enabled: true,
          lifecycleState: 'active',
          readinessState: 'ready',
          completionState: 'incomplete',
          priority: 'normal',
          routeCategory: 'review',
          linkedPortfolioIds: ['p1'],
          blockingReasons: [],
          riskThemes: ['governance_risk_rising'],
          strengths: [],
          limitations: [],
        }),
      } as any,
    });

    const [link] = linker.buildLinks();
    expect(link?.linkedActionIds).toEqual(['review-governance-exposure']);
    expect(link?.rationale).toContain('review-governance-exposure:shared_risk_theme:governance_risk_rising');
    expect(link?.rationale).toContain('review-governance-exposure:matching_route_category:review');
  });

  it('T-AO-L2 excludes unrelated actions', () => {
    const linker = createActionPlanLinker({
      registry: {
        getActionPlanDefinitions: () => [{
          actionPlanId: 'liquidity-defense-plan',
          displayName: 'Liquidity Defense Plan',
          planType: 'liquidity_defense',
          enabled: true,
          matchingRules: {
            routeCategories: ['escalate'],
            riskThemes: ['liquidity_stress'],
          }
        }],
        getActionPlanDefinitionById: () => { throw new Error('unused'); }
      } as any,
      portfolioActionInspection: {
        listPortfolioActions: () => [{
          actionId: 'review-yield-instability',
          displayName: 'Review Yield Instability',
          actionType: 'yield_review',
          enabled: true,
        }],
        inspectPortfolioAction: () => ({
          actionId: 'review-yield-instability',
          displayName: 'Review Yield Instability',
          actionType: 'yield_review',
          enabled: true,
          lifecycleState: 'active',
          readinessState: 'analyzing',
          completionState: 'incomplete',
          priority: 'normal',
          routeCategory: 'review',
          linkedPortfolioIds: ['p1'],
          blockingReasons: [],
          riskThemes: ['yield_instability'],
          strengths: [],
          limitations: [],
        }),
      } as any,
    });

    const [link] = linker.buildLinks();
    expect(link?.linkedActionIds).toEqual([]);
  });

  it('T-AO-L3 rationale ordering is deterministic', () => {
    const linker = createActionPlanLinker({
      registry: {
        getActionPlanDefinitions: () => [{
          actionPlanId: 'risk-reduction-plan',
          displayName: 'Risk Reduction Plan',
          planType: 'risk_reduction',
          enabled: true,
          matchingRules: {
            routeCategories: ['escalate'],
            riskThemes: ['liquidity_stress'],
          }
        }],
        getActionPlanDefinitionById: () => { throw new Error('unused'); }
      } as any,
      portfolioActionInspection: {
        listPortfolioActions: () => [{
          actionId: 'reduce-risk-exposure',
          displayName: 'Reduce Risk Exposure',
          actionType: 'risk_reduction',
          enabled: true,
        }],
        inspectPortfolioAction: () => ({
          actionId: 'reduce-risk-exposure',
          displayName: 'Reduce Risk Exposure',
          actionType: 'risk_reduction',
          enabled: true,
          lifecycleState: 'stabilizing',
          readinessState: 'blocked',
          completionState: 'inconclusive',
          priority: 'critical',
          routeCategory: 'escalate',
          linkedPortfolioIds: ['p1'],
          blockingReasons: ['unresolved_market_conflicts'],
          riskThemes: ['liquidity_stress'],
          strengths: [],
          limitations: ['completion_inconclusive'],
        }),
      } as any,
    });

    const [link] = linker.buildLinks();
    expect(link?.rationale).toEqual([
      'reduce-risk-exposure:explicit_definition_match:risk',
      'reduce-risk-exposure:matching_route_category:escalate',
      'reduce-risk-exposure:shared_risk_theme:liquidity_stress',
    ]);
  });
});
