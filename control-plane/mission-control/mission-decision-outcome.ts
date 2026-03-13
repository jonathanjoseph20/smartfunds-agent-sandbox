import type {
  MissionDecisionOutcome,
  OperatorDecisionRecord,
} from './mission-review-types.ts';

function precedence(outcome: OperatorDecisionRecord['decisionOutcome']): number {
  if (outcome === 'rejected') {
    return 70;
  }
  if (outcome === 'changes_requested') {
    return 60;
  }
  if (outcome === 'deferred') {
    return 50;
  }
  if (outcome === 'review_escalated') {
    return 40;
  }
  if (outcome === 'approved') {
    return 30;
  }
  return 10;
}

export function deriveMissionDecisionOutcome(input: {
  decisionRecords: OperatorDecisionRecord[];
}): {
  decisionOutcome: MissionDecisionOutcome;
  activeDecisionRecordId: string | null;
} {
  if (input.decisionRecords.length === 0) {
    return {
      decisionOutcome: 'pending',
      activeDecisionRecordId: null,
    };
  }

  const withIndex = input.decisionRecords.map((record, index) => ({ record, index }));
  withIndex.sort((left, right) => {
    const byIndex = right.index - left.index;
    if (byIndex !== 0) {
      return byIndex;
    }

    const byPrecedence = precedence(right.record.decisionOutcome) - precedence(left.record.decisionOutcome);
    if (byPrecedence !== 0) {
      return byPrecedence;
    }

    return right.record.decisionRecordId.localeCompare(left.record.decisionRecordId);
  });

  return {
    decisionOutcome: withIndex[0].record.decisionOutcome,
    activeDecisionRecordId: withIndex[0].record.decisionRecordId,
  };
}
