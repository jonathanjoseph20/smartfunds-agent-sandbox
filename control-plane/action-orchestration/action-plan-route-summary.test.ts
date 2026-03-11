import { describe, expect, it } from 'vitest';

import { evaluateActionPlanRouteSummary } from './action-plan-route-summary.ts';

describe('action-orchestration route summary', () => {
  it('T-AO-RS1 selects escalate bundle when escalate route is present', () => {
    const result = evaluateActionPlanRouteSummary({
      actionPlanId: 'risk-reduction-plan',
      link: {
        actionPlanId: 'risk-reduction-plan',
        linkedActionIds: ['a1'],
        linkedActions: [],
        riskThemes: [],
        routeCategories: ['monitor', 'escalate'],
        rationale: [],
      },
    });

    expect(result.routeSummary).toBe('escalate_bundle');
  });

  it('T-AO-RS2 selects allocation review bundle when prepare allocation review is present', () => {
    const result = evaluateActionPlanRouteSummary({
      actionPlanId: 'risk-reduction-plan',
      link: {
        actionPlanId: 'risk-reduction-plan',
        linkedActionIds: ['a1'],
        linkedActions: [],
        riskThemes: [],
        routeCategories: ['prepare_allocation_review'],
        rationale: [],
      },
    });

    expect(result.routeSummary).toBe('allocation_review_bundle');
  });

  it('T-AO-RS3 defaults to monitor bundle with no routes', () => {
    const result = evaluateActionPlanRouteSummary({
      actionPlanId: 'risk-reduction-plan',
      link: {
        actionPlanId: 'risk-reduction-plan',
        linkedActionIds: [],
        linkedActions: [],
        riskThemes: [],
        routeCategories: [],
        rationale: [],
      },
    });

    expect(result.routeSummary).toBe('monitor_bundle');
  });
});
