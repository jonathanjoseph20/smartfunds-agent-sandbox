import { deriveMissionPortfolioClosureEligibilityId, uniqueSortedStrings } from './mission-portfolio-resolution-identity.ts';
import type {
  MissionPortfolioClosureEligibilityRecord,
  MissionPortfolioResolutionStatusRecord,
  MissionPortfolioStabilization,
} from './mission-portfolio-resolution-types.ts';

export function deriveMissionPortfolioClosureEligibility(input: {
  missionPortfolioId: string;
  stabilization: MissionPortfolioStabilization;
  resolution: MissionPortfolioResolutionStatusRecord;
  unresolvedRequirementCount: number;
  openEscalationCount: number;
  blockingClusterCount: number;
}): MissionPortfolioClosureEligibilityRecord {
  let closureEligibility: MissionPortfolioClosureEligibilityRecord['closureEligibility'] = 'not_closeable';

  if (input.stabilization.stabilizationStatus === 'inconclusive' || input.resolution.resolutionStatus === 'inconclusive') {
    closureEligibility = 'inconclusive';
  } else if (input.blockingClusterCount > 0) {
    closureEligibility = 'blocked_from_closure';
  } else if (input.unresolvedRequirementCount > 0 || input.openEscalationCount > 0) {
    closureEligibility = 'not_closeable';
  } else if (
    input.resolution.resolutionStatus === 'resolved'
    && input.stabilization.stabilizationStatus === 'stable'
  ) {
    closureEligibility = 'closeable';
  } else {
    closureEligibility = 'conditionally_closeable';
  }

  const reasonTokens = uniqueSortedStrings([
    `stabilization:${input.stabilization.stabilizationStatus}`,
    `resolution:${input.resolution.resolutionStatus}`,
    `unresolved_requirements:${String(input.unresolvedRequirementCount)}`,
    `open_escalations:${String(input.openEscalationCount)}`,
    `blocking_clusters:${String(input.blockingClusterCount)}`,
  ]);

  return {
    portfolioClosureEligibilityId: deriveMissionPortfolioClosureEligibilityId({
      missionPortfolioId: input.missionPortfolioId,
      closureEligibility,
      reasonTokens,
      unresolvedRequirementCount: input.unresolvedRequirementCount,
      openEscalationCount: input.openEscalationCount,
      blockingClusterCount: input.blockingClusterCount,
    }),
    missionPortfolioId: input.missionPortfolioId,
    closureEligibility,
    reasonTokens,
    unresolvedRequirementCount: input.unresolvedRequirementCount,
    openEscalationCount: input.openEscalationCount,
    blockingClusterCount: input.blockingClusterCount,
    state: closureEligibility === 'closeable'
      ? 'resolved'
      : (closureEligibility === 'inconclusive' ? 'inconclusive' : 'active'),
  };
}
