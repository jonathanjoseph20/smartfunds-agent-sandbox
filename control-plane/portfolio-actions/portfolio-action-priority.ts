import type {
  LinkedPortfolioActionUnit,
  PortfolioActionPriorityEvaluation,
  PortfolioActionReadinessEvaluation,
  PortfolioActionCompletionEvaluation,
  PortfolioActionDefinition,
  PortfolioActionPriority,
} from './portfolio-action-types.ts';

const PRIORITY_RANK: Record<PortfolioActionPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function maxPriority(values: PortfolioActionPriority[]): PortfolioActionPriority {
  return [...values].sort((left, right) => PRIORITY_RANK[right] - PRIORITY_RANK[left])[0] ?? 'normal';
}

export function evaluatePortfolioActionPriority(input: {
  definition: PortfolioActionDefinition;
  link: LinkedPortfolioActionUnit;
  readiness: PortfolioActionReadinessEvaluation;
  completion: PortfolioActionCompletionEvaluation;
}): PortfolioActionPriorityEvaluation {
  const reasons: string[] = [];

  const hasConflicts = input.readiness.blockingReasons.some((reason) => reason === 'unresolved_market_conflicts');
  const hasContradictions = input.readiness.blockingReasons.some((reason) => reason === 'contradictory_exposure_signals');
  const hasConcentrationWarnings = input.link.concentrationWarnings.length > 0;
  const hasEscalationRiskTheme = input.link.riskThemes.some((theme) => (
    theme === 'governance_risk_rising' || theme === 'liquidity_stress'
  ));

  if (hasConflicts || hasContradictions) {
    reasons.push(...input.readiness.blockingReasons.filter((reason) => (
      reason === 'unresolved_market_conflicts' || reason === 'contradictory_exposure_signals'
    )));

    return {
      actionId: input.definition.actionId,
      priority: 'critical',
      reasons: uniqueSorted(reasons),
      routeCategory: 'escalate',
    };
  }

  if (input.readiness.readinessState === 'blocked') {
    reasons.push('action_readiness_blocked');
    return {
      actionId: input.definition.actionId,
      priority: 'high',
      reasons: uniqueSorted(reasons),
      routeCategory: 'escalate',
    };
  }

  const baseline = maxPriority([
    hasEscalationRiskTheme ? 'high' : 'normal',
    hasConcentrationWarnings ? 'high' : 'normal',
    input.readiness.readinessState === 'analyzing' ? 'normal' : 'low',
    input.completion.completionState === 'inconclusive' ? 'high' : 'low',
  ]);

  if (hasEscalationRiskTheme) {
    reasons.push('elevated_risk_theme');
  }
  if (hasConcentrationWarnings) {
    reasons.push('concentration_warning_detected');
  }
  if (input.readiness.readinessState === 'analyzing') {
    reasons.push('analysis_in_progress');
  }
  if (input.completion.completionState === 'inconclusive') {
    reasons.push('completion_inconclusive');
  }
  if (reasons.length === 0) {
    reasons.push('no_priority_escalators_detected');
  }

  if (baseline === 'high') {
    return {
      actionId: input.definition.actionId,
      priority: 'high',
      reasons: uniqueSorted(reasons),
      routeCategory: 'prepare_allocation_review',
    };
  }

  if (baseline === 'normal') {
    return {
      actionId: input.definition.actionId,
      priority: 'normal',
      reasons: uniqueSorted(reasons),
      routeCategory: 'review',
    };
  }

  return {
    actionId: input.definition.actionId,
    priority: 'low',
    reasons: uniqueSorted(reasons),
    routeCategory: 'monitor',
  };
}
