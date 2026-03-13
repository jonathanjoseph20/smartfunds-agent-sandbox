import type {
  MissionPortfolioClosureState,
  MissionPortfolioResolutionOutcome,
  MissionPortfolioResolutionStatusRecord,
  MissionPortfolioStabilization,
  PortfolioResolutionActionRecord,
} from './mission-portfolio-resolution-types.ts';

export function deriveMissionPortfolioResolutionOutcome(input: {
  stabilization: MissionPortfolioStabilization;
  resolution: MissionPortfolioResolutionStatusRecord;
  closureState: MissionPortfolioClosureState;
  actionRecords: PortfolioResolutionActionRecord[];
}): MissionPortfolioResolutionOutcome {
  if (input.stabilization.stabilizationStatus === 'inconclusive' || input.resolution.resolutionStatus === 'inconclusive' || input.closureState === 'inconclusive') {
    return 'inconclusive';
  }

  if (input.closureState === 'archived') {
    return 'archived';
  }

  if (input.closureState === 'closed') {
    return 'closed';
  }

  if (input.closureState === 'reopened') {
    return 'reopened';
  }

  const latestAction = input.actionRecords[input.actionRecords.length - 1] ?? null;
  if (latestAction?.actionType === 'defer_closure') {
    return 'deferred';
  }

  if (input.resolution.resolutionStatus === 'resolved') {
    return 'resolved';
  }

  if (input.stabilization.stabilizationStatus === 'stable') {
    return 'stabilized';
  }

  return 'pending';
}
