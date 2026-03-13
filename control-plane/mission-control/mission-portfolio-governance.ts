import type { MissionPortfolioGovernancePosture } from './mission-portfolio-types.ts';

export interface MissionPortfolioGovernanceSignal {
  missionRunId: string;
  governanceStatus: string;
  decisionOutcome: string;
}

export function deriveMissionPortfolioGovernancePosture(input: {
  signals: MissionPortfolioGovernanceSignal[];
}): MissionPortfolioGovernancePosture {
  if (input.signals.length === 0) {
    return 'inconclusive';
  }

  const statuses = input.signals.map((entry) => entry.governanceStatus);

  if (statuses.includes('rejected')) {
    return 'decision_blocked';
  }

  const awaiting = statuses.filter((status) => status === 'awaiting_review' || status === 'under_review' || status === 'escalated_for_decision');
  if (awaiting.length > 0) {
    return 'awaiting_reviews';
  }

  const deferred = statuses.filter((status) => status === 'deferred');
  if (deferred.length === statuses.length) {
    return 'deferred';
  }

  const clearEligible = statuses.filter((status) => status === 'approved' || status === 'no_review_required');
  if (clearEligible.length === statuses.length) {
    return 'clear';
  }

  if (statuses.includes('inconclusive')) {
    return 'inconclusive';
  }

  return 'mixed';
}
