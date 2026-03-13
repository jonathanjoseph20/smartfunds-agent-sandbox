import { deriveMissionPortfolioResolutionQueueEntryId, uniqueSortedStrings } from './mission-portfolio-resolution-identity.ts';
import type {
  MissionPortfolioClosureEligibilityRecord,
  MissionPortfolioResolutionHistoryEntry,
  MissionPortfolioResolutionQueueEntry,
  MissionPortfolioResolutionStatusRecord,
} from './mission-portfolio-resolution-types.ts';

function queueStateFromHistory(input: {
  portfolioResolutionQueueEntryId: string;
  historyEntries: MissionPortfolioResolutionHistoryEntry[];
  fallback: MissionPortfolioResolutionQueueEntry['queueState'];
}): MissionPortfolioResolutionQueueEntry['queueState'] {
  let state: MissionPortfolioResolutionQueueEntry['queueState'] = 'queued';

  for (const entry of input.historyEntries) {
    const actionRecord = entry.payload.actionRecord as Record<string, unknown> | undefined;
    const queueEntryId = (entry.payload.portfolioResolutionQueueEntryId as string | undefined)
      ?? (actionRecord?.portfolioResolutionQueueEntryId as string | undefined);

    if (queueEntryId !== input.portfolioResolutionQueueEntryId) {
      continue;
    }

    if (entry.eventType === 'portfolio_resolution_queued') {
      state = 'awaiting_resolution_review';
      continue;
    }

    if (entry.eventType === 'portfolio_marked_stable' || entry.eventType === 'portfolio_marked_resolved') {
      state = 'under_resolution_review';
      continue;
    }

    if (entry.eventType === 'portfolio_closure_deferred') {
      state = 'deferred';
      continue;
    }

    if (entry.eventType === 'portfolio_closed' || entry.eventType === 'portfolio_resolution_closed' || entry.eventType === 'portfolio_archived') {
      state = 'closed';
    }
  }

  return state === 'queued' ? input.fallback : state;
}

export function deriveResolutionPriority(input: {
  openEscalationCount: number;
  unresolvedRequirementCount: number;
  blockingClusterCount: number;
  criticalMissionCount: number;
  highMissionCount: number;
  resolutionStatus: MissionPortfolioResolutionStatusRecord['resolutionStatus'];
}): number {
  const resolutionWeight = input.resolutionStatus === 'reopened'
    ? 400
    : (input.resolutionStatus === 'unresolved' ? 300 : (input.resolutionStatus === 'partially_resolved' ? 200 : 100));

  return resolutionWeight
    + (input.blockingClusterCount * 100)
    + (input.openEscalationCount * 30)
    + (input.unresolvedRequirementCount * 10)
    + (input.criticalMissionCount * 5)
    + input.highMissionCount;
}

export function deriveMissionPortfolioResolutionQueueEntry(input: {
  missionPortfolioId: string;
  resolution: MissionPortfolioResolutionStatusRecord;
  closureEligibility: MissionPortfolioClosureEligibilityRecord;
  openEscalationCount: number;
  unresolvedRequirementCount: number;
  blockingClusterCount: number;
  criticalMissionCount: number;
  highMissionCount: number;
  historyEntries: MissionPortfolioResolutionHistoryEntry[];
  reasonTokens: string[];
  isTerminal: boolean;
}): MissionPortfolioResolutionQueueEntry | null {
  if (input.isTerminal) {
    return null;
  }

  const closedCycleCount = input.historyEntries
    .filter((entry) => entry.eventType === 'portfolio_resolution_closed')
    .length;

  const queueCycle = closedCycleCount + 1;
  const priority = deriveResolutionPriority({
    openEscalationCount: input.openEscalationCount,
    unresolvedRequirementCount: input.unresolvedRequirementCount,
    blockingClusterCount: input.blockingClusterCount,
    criticalMissionCount: input.criticalMissionCount,
    highMissionCount: input.highMissionCount,
    resolutionStatus: input.resolution.resolutionStatus,
  });

  const normalizedReasonTokens = uniqueSortedStrings(input.reasonTokens);
  const portfolioResolutionQueueEntryId = deriveMissionPortfolioResolutionQueueEntryId({
    missionPortfolioId: input.missionPortfolioId,
    resolutionStatus: input.resolution.resolutionStatus,
    closureEligibility: input.closureEligibility.closureEligibility,
    queueCycle,
    priority,
    reasonTokens: normalizedReasonTokens,
  });

  const fallback = input.closureEligibility.closureEligibility === 'closeable'
    ? 'ready_to_close'
    : 'queued';

  return {
    portfolioResolutionQueueEntryId,
    missionPortfolioId: input.missionPortfolioId,
    resolutionStatus: input.resolution.resolutionStatus,
    closureEligibility: input.closureEligibility.closureEligibility,
    priority,
    queueState: queueStateFromHistory({
      portfolioResolutionQueueEntryId,
      historyEntries: input.historyEntries,
      fallback,
    }),
    reasonTokens: normalizedReasonTokens,
  };
}
