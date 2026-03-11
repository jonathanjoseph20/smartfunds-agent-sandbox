import type {
  ActionPlanCompletionState,
  ActionPlanLink,
  ActionPlanPriorityLevel,
  ActionPlanPriorityEvaluation,
  ActionPlanReadinessState,
} from './action-plan-types.ts';

const PRIORITY_RANK: Record<ActionPlanPriorityLevel, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function maxPriority(values: ActionPlanPriorityLevel[]): ActionPlanPriorityLevel {
  return [...values].sort((left, right) => PRIORITY_RANK[right] - PRIORITY_RANK[left])[0] ?? 'normal';
}

export function evaluateActionPlanPriority(input: {
  actionPlanId: string;
  link: ActionPlanLink;
  readinessState: ActionPlanReadinessState;
  completionState: ActionPlanCompletionState;
}): ActionPlanPriorityEvaluation {
  const reasons: string[] = [];

  const highestComponentPriority = maxPriority(input.link.linkedActions.map((entry) => entry.priority));
  const hasCriticalComponent = highestComponentPriority === 'critical';
  const hasBlockedComponent = input.link.linkedActions.some((entry) => entry.readinessState === 'blocked');
  const blockerCount = input.link.linkedActions.flatMap((entry) => entry.blockingReasons).length;
  const breadth = input.link.linkedActionIds.length;
  const riskThemeConcentration = input.link.riskThemes.length;

  if (hasCriticalComponent) {
    reasons.push('linked_action_priority:critical');
  }
  if (hasBlockedComponent || input.readinessState === 'blocked') {
    reasons.push('linked_action_blocked');
  }
  if (blockerCount >= 2) {
    reasons.push('blocker_severity:elevated');
  }
  if (breadth >= 3) {
    reasons.push('portfolio_breadth:multi_action');
  }
  if (riskThemeConcentration >= 2) {
    reasons.push('risk_theme_concentration:elevated');
  }
  if (input.completionState === 'inconclusive') {
    reasons.push('plan_completion:inconclusive');
  }

  if (hasCriticalComponent || (hasBlockedComponent && blockerCount >= 2)) {
    return {
      actionPlanId: input.actionPlanId,
      priority: 'critical',
      reasons: uniqueSorted(reasons.length > 0 ? reasons : ['critical_conditions_met']),
    };
  }

  if (
    highestComponentPriority === 'high'
    || hasBlockedComponent
    || input.readinessState === 'blocked'
    || input.completionState === 'inconclusive'
    || breadth >= 3
  ) {
    return {
      actionPlanId: input.actionPlanId,
      priority: 'high',
      reasons: uniqueSorted(reasons.length > 0 ? reasons : ['elevated_conditions_met']),
    };
  }

  if (highestComponentPriority === 'normal' || input.readinessState === 'analyzing' || breadth > 0) {
    return {
      actionPlanId: input.actionPlanId,
      priority: 'normal',
      reasons: uniqueSorted(reasons.length > 0 ? reasons : ['baseline_conditions_met']),
    };
  }

  return {
    actionPlanId: input.actionPlanId,
    priority: 'low',
    reasons: uniqueSorted(reasons.length > 0 ? reasons : ['no_priority_escalators_detected']),
  };
}
