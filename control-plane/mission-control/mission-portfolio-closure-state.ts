import type {
  MissionPortfolioClosureEligibilityRecord,
  MissionPortfolioClosureState,
  MissionPortfolioResolutionStatusRecord,
  PortfolioResolutionActionRecord,
} from './mission-portfolio-resolution-types.ts';

export function deriveMissionPortfolioClosureState(input: {
  closureEligibility: MissionPortfolioClosureEligibilityRecord;
  resolution: MissionPortfolioResolutionStatusRecord;
  actionRecords: PortfolioResolutionActionRecord[];
}): MissionPortfolioClosureState {
  const hasArchiveAction = input.actionRecords.some((entry) => entry.actionType === 'archive');
  const hasReopenAction = input.actionRecords.some((entry) => entry.actionType === 'reopen');
  const hasCloseAction = input.actionRecords.some((entry) => entry.actionType === 'close');
  const hasReviewAction = input.actionRecords.some((entry) => (
    entry.actionType === 'request_resolution_review'
    || entry.actionType === 'mark_stable'
    || entry.actionType === 'mark_resolved'
  ));

  if (input.closureEligibility.closureEligibility === 'inconclusive' || input.resolution.resolutionStatus === 'inconclusive') {
    return 'inconclusive';
  }

  if (hasArchiveAction) {
    return 'archived';
  }

  if (hasReopenAction || input.resolution.resolutionStatus === 'reopened') {
    return 'reopened';
  }

  if (hasCloseAction) {
    return 'closed';
  }

  if (input.closureEligibility.closureEligibility === 'closeable') {
    return 'ready_to_close';
  }

  if (hasReviewAction) {
    return 'under_resolution_review';
  }

  return 'open';
}
