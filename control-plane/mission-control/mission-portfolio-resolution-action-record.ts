import { derivePortfolioResolutionActionRecordId, uniqueSortedStrings } from './mission-portfolio-resolution-identity.ts';
import type {
  MissionPortfolioResolutionActionType,
  MissionPortfolioResolutionOutcome,
  PortfolioResolutionActionRecord,
} from './mission-portfolio-resolution-types.ts';

export function deriveResolutionActionOutcome(input: {
  actionType: MissionPortfolioResolutionActionType;
}): MissionPortfolioResolutionOutcome {
  if (input.actionType === 'mark_stable') {
    return 'stabilized';
  }
  if (input.actionType === 'mark_resolved') {
    return 'resolved';
  }
  if (input.actionType === 'defer_closure') {
    return 'deferred';
  }
  if (input.actionType === 'close') {
    return 'closed';
  }
  if (input.actionType === 'reopen') {
    return 'reopened';
  }
  if (input.actionType === 'archive') {
    return 'archived';
  }
  return 'pending';
}

export function createPortfolioResolutionActionRecord(input: {
  missionPortfolioId: string;
  portfolioResolutionQueueEntryId: string;
  actionType: MissionPortfolioResolutionActionType;
  reasonTokens?: string[];
  linkedRequirementIds?: string[];
  linkedEscalationIds?: string[];
}): PortfolioResolutionActionRecord {
  const reasonTokens = uniqueSortedStrings(input.reasonTokens);
  const linkedRequirementIds = uniqueSortedStrings(input.linkedRequirementIds);
  const linkedEscalationIds = uniqueSortedStrings(input.linkedEscalationIds);
  const actionOutcome = deriveResolutionActionOutcome({ actionType: input.actionType });

  return {
    portfolioResolutionActionRecordId: derivePortfolioResolutionActionRecordId({
      missionPortfolioId: input.missionPortfolioId,
      portfolioResolutionQueueEntryId: input.portfolioResolutionQueueEntryId,
      actionType: input.actionType,
      actionOutcome,
      reasonTokens,
      linkedRequirementIds,
      linkedEscalationIds,
    }),
    missionPortfolioId: input.missionPortfolioId,
    portfolioResolutionQueueEntryId: input.portfolioResolutionQueueEntryId,
    actionType: input.actionType,
    reasonTokens,
    linkedRequirementIds,
    linkedEscalationIds,
    actionOutcome,
    actor: 'operator',
    state: 'recorded',
  };
}
