import type {
  CrossPortfolioPortfolioSignal,
  CrossPortfolioReadinessPosture,
} from './cross-portfolio-mission-intelligence-types.ts';

export function deriveCrossPortfolioReadinessPosture(input: {
  portfolioSignals: CrossPortfolioPortfolioSignal[];
}): CrossPortfolioReadinessPosture {
  if (input.portfolioSignals.length === 0) {
    return 'inconclusive';
  }

  const readyCount = input.portfolioSignals.filter((entry) => entry.readinessState === 'ready').length;
  const blockedCount = input.portfolioSignals.filter((entry) => (
    entry.readinessState === 'blocked' || entry.closureEligibility === 'blocked_from_closure'
  )).length;
  const degradedCount = input.portfolioSignals.filter((entry) => (
    entry.readinessState === 'degraded' || entry.healthState === 'degraded'
  )).length;
  const inconclusiveCount = input.portfolioSignals.filter((entry) => entry.readinessState === 'inconclusive').length;

  if (blockedCount > 0) {
    return 'blocked';
  }

  if (inconclusiveCount === input.portfolioSignals.length) {
    return 'inconclusive';
  }

  if (readyCount === input.portfolioSignals.length) {
    return 'ready';
  }

  if (readyCount > 0) {
    return 'partially_ready';
  }

  if (degradedCount > 0) {
    return 'degraded';
  }

  return 'not_ready';
}
