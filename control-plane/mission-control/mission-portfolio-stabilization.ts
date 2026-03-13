import { deriveMissionPortfolioStabilizationId, uniqueSortedStrings } from './mission-portfolio-resolution-identity.ts';
import type { MissionPortfolioAttentionProjection } from './mission-portfolio-attention-types.ts';
import type {
  MissionPortfolioResolutionHistoryEntry,
  MissionPortfolioStabilization,
} from './mission-portfolio-resolution-types.ts';

function hasAction(history: MissionPortfolioResolutionHistoryEntry[], eventType: MissionPortfolioResolutionHistoryEntry['eventType']): boolean {
  return history.some((entry) => entry.eventType === eventType);
}

export function deriveMissionPortfolioStabilization(input: {
  attention: MissionPortfolioAttentionProjection;
  resolutionHistory: MissionPortfolioResolutionHistoryEntry[];
}): MissionPortfolioStabilization {
  const linkedAttentionRequirementIds = uniqueSortedStrings(
    input.attention.attentionRequirements.map((entry) => entry.portfolioAttentionRequirementId)
  );
  const linkedEscalationIds = uniqueSortedStrings(
    input.attention.escalations.map((entry) => entry.portfolioEscalationId)
  );
  const linkedBlockingClusterIds = uniqueSortedStrings(input.attention.linkedBlockingClusters);

  const unstableSignal = linkedAttentionRequirementIds.length > 0
    || linkedEscalationIds.length > 0
    || linkedBlockingClusterIds.length > 0;

  let stabilizationStatus: MissionPortfolioStabilization['stabilizationStatus'] = 'not_stable';

  const markedStable = hasAction(input.resolutionHistory, 'portfolio_marked_stable');

  if (input.attention.attentionStatus === 'inconclusive') {
    stabilizationStatus = 'inconclusive';
  } else if (markedStable && unstableSignal) {
    stabilizationStatus = 'regressed';
  } else if (markedStable && !unstableSignal) {
    stabilizationStatus = 'stable';
  } else if (!markedStable && !unstableSignal) {
    stabilizationStatus = 'stabilizing';
  }

  const reasonTokens = uniqueSortedStrings([
    `attention_status:${input.attention.attentionStatus}`,
    `requirements:${String(linkedAttentionRequirementIds.length)}`,
    `escalations:${String(linkedEscalationIds.length)}`,
    `blocking_clusters:${String(linkedBlockingClusterIds.length)}`,
    ...(markedStable ? ['operator_marked_stable'] : []),
  ]);

  return {
    portfolioStabilizationId: deriveMissionPortfolioStabilizationId({
      missionPortfolioId: input.attention.missionPortfolioId,
      stabilizationStatus,
      reasonTokens,
      linkedAttentionRequirementIds,
      linkedEscalationIds,
      linkedBlockingClusterIds,
    }),
    missionPortfolioId: input.attention.missionPortfolioId,
    stabilizationStatus,
    reasonTokens,
    linkedAttentionRequirementIds,
    linkedEscalationIds,
    linkedBlockingClusterIds,
    state: stabilizationStatus === 'inconclusive'
      ? 'inconclusive'
      : (stabilizationStatus === 'stable' ? 'resolved' : 'active'),
  };
}
