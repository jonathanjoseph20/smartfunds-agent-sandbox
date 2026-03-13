import type {
  MissionPortfolioActionOutcome,
  PortfolioOperatorActionRecord,
} from './mission-portfolio-attention-types.ts';

function precedence(outcome: PortfolioOperatorActionRecord['actionOutcome']): number {
  if (outcome === 'suppressed') {
    return 70;
  }
  if (outcome === 'escalated') {
    return 60;
  }
  if (outcome === 'deferred') {
    return 50;
  }
  if (outcome === 'review_requested') {
    return 40;
  }
  if (outcome === 'acknowledged') {
    return 30;
  }
  return 10;
}

export function deriveMissionPortfolioActionOutcome(input: {
  actionRecords: PortfolioOperatorActionRecord[];
}): {
  actionOutcome: MissionPortfolioActionOutcome;
  activeActionRecordId: string | null;
} {
  if (input.actionRecords.length === 0) {
    return {
      actionOutcome: 'pending',
      activeActionRecordId: null,
    };
  }

  const withIndex = input.actionRecords.map((record, index) => ({ record, index }));
  withIndex.sort((left, right) => {
    const byIndex = right.index - left.index;
    if (byIndex !== 0) {
      return byIndex;
    }

    const byPrecedence = precedence(right.record.actionOutcome) - precedence(left.record.actionOutcome);
    if (byPrecedence !== 0) {
      return byPrecedence;
    }

    return right.record.portfolioOperatorActionRecordId.localeCompare(left.record.portfolioOperatorActionRecordId);
  });

  return {
    actionOutcome: withIndex[0].record.actionOutcome,
    activeActionRecordId: withIndex[0].record.portfolioOperatorActionRecordId,
  };
}
