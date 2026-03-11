import type {
  ActionPlanLink,
  ActionPlanRouteSummaryEvaluation,
} from './action-plan-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function evaluateActionPlanRouteSummary(input: {
  actionPlanId: string;
  link: ActionPlanLink;
}): ActionPlanRouteSummaryEvaluation {
  const reasons: string[] = [];

  if (input.link.routeCategories.includes('escalate')) {
    reasons.push('contains_route_category:escalate');
    return {
      actionPlanId: input.actionPlanId,
      routeSummary: 'escalate_bundle',
      reasons: uniqueSorted(reasons),
    };
  }

  if (input.link.routeCategories.includes('prepare_allocation_review')) {
    reasons.push('contains_route_category:prepare_allocation_review');
    return {
      actionPlanId: input.actionPlanId,
      routeSummary: 'allocation_review_bundle',
      reasons: uniqueSorted(reasons),
    };
  }

  if (input.link.routeCategories.includes('review')) {
    reasons.push('contains_route_category:review');
    return {
      actionPlanId: input.actionPlanId,
      routeSummary: 'review_bundle',
      reasons: uniqueSorted(reasons),
    };
  }

  reasons.push('default_route_category:monitor');
  return {
    actionPlanId: input.actionPlanId,
    routeSummary: 'monitor_bundle',
    reasons: uniqueSorted(reasons),
  };
}
