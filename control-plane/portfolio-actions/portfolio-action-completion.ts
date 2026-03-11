import type {
  LinkedPortfolioActionUnit,
  PortfolioActionCompletionEvaluation,
  PortfolioActionDefinition,
  PortfolioActionReadinessEvaluation,
} from './portfolio-action-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function evaluatePortfolioActionCompletion(input: {
  definition: PortfolioActionDefinition;
  link: LinkedPortfolioActionUnit;
  readiness: PortfolioActionReadinessEvaluation;
}): PortfolioActionCompletionEvaluation {
  if (!input.definition.enabled) {
    return {
      actionId: input.definition.actionId,
      completionState: 'incomplete',
      limitations: uniqueSorted(['action_disabled']),
    };
  }

  if (input.readiness.readinessState === 'blocked' || input.readiness.blockingReasons.length > 0) {
    return {
      actionId: input.definition.actionId,
      completionState: 'inconclusive',
      limitations: uniqueSorted([
        'completion_inconclusive',
        ...input.readiness.blockingReasons,
      ]),
    };
  }

  if (input.link.linkedPortfolios.some((portfolio) => portfolio.completionState === 'inconclusive')) {
    return {
      actionId: input.definition.actionId,
      completionState: 'inconclusive',
      limitations: uniqueSorted(['upstream_completion_inconclusive', 'completion_inconclusive']),
    };
  }

  const allCompleted = input.link.linkedPortfolios.length > 0
    && input.link.linkedPortfolios.every((portfolio) => portfolio.completionState === 'completed');

  if (allCompleted && input.readiness.readinessState === 'ready') {
    return {
      actionId: input.definition.actionId,
      completionState: 'completed',
      limitations: [],
    };
  }

  return {
    actionId: input.definition.actionId,
    completionState: 'incomplete',
    limitations: uniqueSorted([
      ...(input.link.linkedPortfolios.some((portfolio) => portfolio.completionState !== 'completed')
        ? ['linked_portfolios_still_progressing']
        : []),
    ]),
  };
}
