import { deriveMissionPortfolioResolutionStatusId, uniqueSortedStrings } from './mission-portfolio-resolution-identity.ts';
import type { MissionPortfolioAttentionProjection } from './mission-portfolio-attention-types.ts';
import type {
  MissionPortfolioResolutionStatusRecord,
  PortfolioResolutionActionRecord,
} from './mission-portfolio-resolution-types.ts';

export function deriveMissionPortfolioResolutionStatus(input: {
  attention: MissionPortfolioAttentionProjection;
  actionRecords: PortfolioResolutionActionRecord[];
}): MissionPortfolioResolutionStatusRecord {
  const linkedRequirementIds = uniqueSortedStrings(
    input.attention.attentionRequirements.map((entry) => entry.portfolioAttentionRequirementId)
  );
  const linkedActionRecordIds = uniqueSortedStrings(
    input.actionRecords.map((entry) => entry.portfolioResolutionActionRecordId)
  );

  const hasResolvedAction = input.actionRecords.some((entry) => entry.actionType === 'mark_resolved');
  const hasReopenAction = input.actionRecords.some((entry) => entry.actionType === 'reopen');
  const hasArchiveAction = input.actionRecords.some((entry) => entry.actionType === 'archive');

  let resolutionStatus: MissionPortfolioResolutionStatusRecord['resolutionStatus'] = 'unresolved';

  if (input.attention.attentionStatus === 'inconclusive') {
    resolutionStatus = 'inconclusive';
  } else if (hasReopenAction && !hasArchiveAction) {
    resolutionStatus = 'reopened';
  } else if (hasResolvedAction && linkedRequirementIds.length === 0 && input.attention.escalations.filter((entry) => entry.state === 'open').length === 0) {
    resolutionStatus = 'resolved';
  } else if (hasResolvedAction || input.actionRecords.some((entry) => entry.actionType === 'mark_stable')) {
    resolutionStatus = 'partially_resolved';
  }

  const reasonTokens = uniqueSortedStrings([
    `attention_status:${input.attention.attentionStatus}`,
    `linked_requirements:${String(linkedRequirementIds.length)}`,
    `action_records:${String(linkedActionRecordIds.length)}`,
    ...(hasReopenAction ? ['action:reopen_present'] : []),
    ...(hasResolvedAction ? ['action:mark_resolved_present'] : []),
  ]);

  return {
    portfolioResolutionStatusId: deriveMissionPortfolioResolutionStatusId({
      missionPortfolioId: input.attention.missionPortfolioId,
      resolutionStatus,
      reasonTokens,
      linkedActionRecordIds,
      linkedRequirementIds,
    }),
    missionPortfolioId: input.attention.missionPortfolioId,
    resolutionStatus,
    reasonTokens,
    linkedActionRecordIds,
    linkedRequirementIds,
    state: resolutionStatus === 'resolved'
      ? 'resolved'
      : (resolutionStatus === 'inconclusive' ? 'inconclusive' : 'active'),
  };
}
