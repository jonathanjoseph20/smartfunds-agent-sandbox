import type {
  LinkedPortfolioActionUnit,
  PortfolioActionDefinition,
  PortfolioActionReadinessEvaluation,
} from './portfolio-action-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseMinLinkedPortfolios(rules: string[] | undefined): number {
  for (const rule of rules ?? []) {
    if (rule.startsWith('min_linked_portfolios:')) {
      const parsed = Number.parseInt(rule.slice('min_linked_portfolios:'.length), 10);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return 1;
}

function hasUnresolvedMarketConflicts(input: LinkedPortfolioActionUnit): boolean {
  return input.linkedPortfolios.some((portfolio) => (
    portfolio.blockingReasons.some((reason) => reason.includes('conflict'))
    || portfolio.limitations.some((reason) => reason.includes('conflict'))
  ));
}

function hasContradictoryExposureSignals(input: LinkedPortfolioActionUnit): boolean {
  const blockedCount = input.exposureFlags.filter((flag) => flag.startsWith('blocked_market_synthesis:')).length;
  const inconclusiveCount = input.exposureFlags.filter((flag) => flag.startsWith('inconclusive_market_synthesis:')).length;
  const coherentCount = input.linkedPortfolios.filter((portfolio) => portfolio.readinessState === 'coherent').length;
  return coherentCount > 0 && (blockedCount > 0 || inconclusiveCount > 0);
}

function hasWeakSupport(input: LinkedPortfolioActionUnit): boolean {
  if (input.linkedPortfolioIds.length === 0) {
    return true;
  }

  const supportedSignals = uniqueSorted([
    ...input.riskThemes,
    ...input.exposureFlags,
    ...input.concentrationWarnings,
  ]);

  return supportedSignals.length < 1;
}

export function evaluatePortfolioActionReadiness(input: {
  definition: PortfolioActionDefinition;
  link: LinkedPortfolioActionUnit;
}): PortfolioActionReadinessEvaluation {
  if (!input.definition.enabled) {
    return {
      actionId: input.definition.actionId,
      readinessState: 'pending',
      blockingReasons: uniqueSorted(['action_disabled']),
      strengths: [],
      limitations: uniqueSorted(['action_disabled']),
    };
  }

  if (input.link.linkedPortfolioIds.length === 0) {
    return {
      actionId: input.definition.actionId,
      readinessState: 'pending',
      blockingReasons: uniqueSorted(['insufficient_portfolio_coverage']),
      strengths: [],
      limitations: uniqueSorted(['insufficient_portfolio_coverage', 'weak_support_for_action_candidate']),
    };
  }

  const blockingReasons: string[] = [];

  const minLinkedPortfolios = parseMinLinkedPortfolios(input.definition.readinessRules);
  if (input.link.linkedPortfolioIds.length < minLinkedPortfolios) {
    blockingReasons.push('insufficient_portfolio_coverage');
  }

  if (input.link.linkedPortfolios.some((portfolio) => portfolio.readinessState === 'blocked')) {
    blockingReasons.push('blocked_portfolio_intelligence');
  }

  if (input.link.linkedPortfolios.some((portfolio) => portfolio.readinessState === 'pending' || portfolio.readinessState === 'analyzing')) {
    blockingReasons.push('incomplete_upstream_readiness');
  }

  if (hasContradictoryExposureSignals(input.link)) {
    blockingReasons.push('contradictory_exposure_signals');
  }

  if (hasWeakSupport(input.link)) {
    blockingReasons.push('weak_support_for_action_candidate');
  }

  if (hasUnresolvedMarketConflicts(input.link)) {
    blockingReasons.push('unresolved_market_conflicts');
  }

  const normalizedBlockingReasons = uniqueSorted(blockingReasons);

  const strengths: string[] = [];
  if (input.link.linkedPortfolioIds.length > 0) {
    strengths.push(`linked_portfolios:${String(input.link.linkedPortfolioIds.length)}`);
  }

  const coherentCount = input.link.linkedPortfolios.filter((portfolio) => portfolio.readinessState === 'coherent').length;
  if (coherentCount > 0) {
    strengths.push(`coherent_portfolios:${String(coherentCount)}`);
  }

  const limitations = uniqueSorted([
    ...normalizedBlockingReasons,
    ...(input.link.linkedPortfolios.some((portfolio) => portfolio.completionState === 'inconclusive')
      ? ['upstream_completion_inconclusive']
      : []),
  ]);

  if (normalizedBlockingReasons.length > 0) {
    return {
      actionId: input.definition.actionId,
      readinessState: 'blocked',
      blockingReasons: normalizedBlockingReasons,
      strengths: uniqueSorted(strengths),
      limitations,
    };
  }

  if (input.link.linkedPortfolios.every((portfolio) => portfolio.readinessState === 'coherent')) {
    return {
      actionId: input.definition.actionId,
      readinessState: 'ready',
      blockingReasons: [],
      strengths: uniqueSorted(strengths),
      limitations,
    };
  }

  if (input.link.linkedPortfolios.some((portfolio) => portfolio.readinessState === 'analyzing' || portfolio.readinessState === 'coherent')) {
    return {
      actionId: input.definition.actionId,
      readinessState: 'analyzing',
      blockingReasons: [],
      strengths: uniqueSorted(strengths),
      limitations,
    };
  }

  return {
    actionId: input.definition.actionId,
    readinessState: 'pending',
    blockingReasons: [],
    strengths: uniqueSorted(strengths),
    limitations,
  };
}
