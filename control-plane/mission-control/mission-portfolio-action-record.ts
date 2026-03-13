import { derivePortfolioOperatorActionRecordId } from './mission-portfolio-attention-identity.ts';
import type {
  MissionPortfolioActionType,
  PortfolioOperatorActionRecord,
} from './mission-portfolio-attention-types.ts';

function uniqueSorted(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function derivePortfolioActionOutcome(input: {
  actionType: MissionPortfolioActionType;
}): PortfolioOperatorActionRecord['actionOutcome'] {
  if (input.actionType === 'acknowledge') {
    return 'acknowledged';
  }
  if (input.actionType === 'defer') {
    return 'deferred';
  }
  if (input.actionType === 'escalate') {
    return 'escalated';
  }
  if (input.actionType === 'suppress') {
    return 'suppressed';
  }
  if (input.actionType === 'force_review' || input.actionType === 'request_portfolio_review') {
    return 'review_requested';
  }
  return 'inconclusive';
}

export function createPortfolioOperatorActionRecord(input: {
  missionPortfolioId: string;
  portfolioAttentionQueueEntryId: string;
  actionType: MissionPortfolioActionType;
  reasonTokens?: string[];
  linkedEscalationIds?: string[];
  linkedRequirementIds?: string[];
}): PortfolioOperatorActionRecord {
  const reasonTokens = uniqueSorted(input.reasonTokens);
  const linkedEscalationIds = uniqueSorted(input.linkedEscalationIds);
  const linkedRequirementIds = uniqueSorted(input.linkedRequirementIds);
  const actionOutcome = derivePortfolioActionOutcome({ actionType: input.actionType });

  return {
    portfolioOperatorActionRecordId: derivePortfolioOperatorActionRecordId({
      missionPortfolioId: input.missionPortfolioId,
      portfolioAttentionQueueEntryId: input.portfolioAttentionQueueEntryId,
      actionType: input.actionType,
      actionOutcome,
      reasonTokens,
      linkedEscalationIds,
      linkedRequirementIds,
    }),
    missionPortfolioId: input.missionPortfolioId,
    portfolioAttentionQueueEntryId: input.portfolioAttentionQueueEntryId,
    actionType: input.actionType,
    reasonTokens,
    linkedEscalationIds,
    linkedRequirementIds,
    actionOutcome,
    state: 'recorded',
  };
}
