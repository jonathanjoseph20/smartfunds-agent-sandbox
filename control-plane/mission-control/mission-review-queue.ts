import { deriveMissionReviewQueueEntryId } from './mission-review-identity.ts';
import type {
  MissionGovernanceStatus,
  MissionReviewHistoryEntry,
  MissionReviewQueueEntry,
  MissionReviewQueueState,
  MissionReviewRequirement,
} from './mission-review-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function determineQueueState(input: {
  reviewQueueEntryId: string;
  historyEntries: MissionReviewHistoryEntry[];
}): MissionReviewQueueState {
  let state: MissionReviewQueueState = 'queued';
  let seenQueueEvent = false;

  for (const entry of input.historyEntries) {
    const payloadQueueEntryId = (entry.payload.reviewQueueEntryId as string | undefined)
      ?? ((entry.payload.queueEntry as Record<string, unknown> | undefined)?.reviewQueueEntryId as string | undefined)
      ?? ((entry.payload.decisionRecord as Record<string, unknown> | undefined)?.reviewQueueEntryId as string | undefined);

    if (payloadQueueEntryId !== input.reviewQueueEntryId) {
      continue;
    }

    if (entry.eventType === 'mission_review_queued') {
      seenQueueEvent = true;
      state = 'awaiting_review';
      continue;
    }

    if (entry.eventType === 'mission_review_started') {
      state = 'under_review';
      continue;
    }

    if (entry.eventType === 'mission_review_deferred') {
      state = 'deferred';
      continue;
    }

    if (entry.eventType === 'mission_decision_recorded') {
      state = 'decision_recorded';
      continue;
    }

    if (entry.eventType === 'mission_review_closed') {
      state = 'closed';
    }
  }

  if (!seenQueueEvent) {
    return 'queued';
  }

  return state;
}

export function selectPrimaryReviewRequirement(input: {
  reviewRequirements: MissionReviewRequirement[];
}): MissionReviewRequirement | null {
  if (input.reviewRequirements.length === 0) {
    return null;
  }

  const priority = [
    'critical_escalation_review',
    'operator_forced_review',
    'dependency_resolution_review',
    'changes_requested_review',
    'priority_review',
    'completion_review',
    'inconclusive_review',
  ] as const;

  const sorted = [...input.reviewRequirements].sort((left, right) => {
    const leftPriority = priority.indexOf(left.reviewRequirementClass);
    const rightPriority = priority.indexOf(right.reviewRequirementClass);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return left.reviewRequirementClass.localeCompare(right.reviewRequirementClass);
  });

  return sorted[0];
}

export function deriveMissionReviewQueueEntry(input: {
  missionRunId: string;
  reviewRequirement: MissionReviewRequirement | null;
  governanceStatus: MissionGovernanceStatus;
  historyEntries: MissionReviewHistoryEntry[];
}): MissionReviewQueueEntry | null {
  if (!input.reviewRequirement) {
    return null;
  }

  const closedCycleCount = input.historyEntries.filter((entry) => {
    if (entry.eventType !== 'mission_review_closed') {
      return false;
    }

    const reviewRequirementClass = (entry.payload.queueEntry as Record<string, unknown> | undefined)?.reviewRequirementClass;
    return reviewRequirementClass === input.reviewRequirement.reviewRequirementClass;
  }).length;

  const queueCycle = closedCycleCount + 1;

  const reviewQueueEntryId = deriveMissionReviewQueueEntryId({
    missionRunId: input.missionRunId,
    reviewRequirementClass: input.reviewRequirement.reviewRequirementClass,
    queueCycle,
    reasonTokens: input.reviewRequirement.reasonTokens,
    linkedEscalationIds: input.reviewRequirement.linkedEscalationIds,
    linkedDependencyIds: input.reviewRequirement.linkedDependencyIds,
  });

  const queueState = determineQueueState({
    reviewQueueEntryId,
    historyEntries: input.historyEntries,
  });

  return {
    reviewQueueEntryId,
    missionRunId: input.missionRunId,
    reviewRequirementClass: input.reviewRequirement.reviewRequirementClass,
    governanceStatus: input.governanceStatus,
    priority: input.reviewRequirement.priority,
    queueState,
    reasonTokens: uniqueSorted(input.reviewRequirement.reasonTokens),
    linkedEscalationIds: uniqueSorted(input.reviewRequirement.linkedEscalationIds),
    linkedDependencyIds: uniqueSorted(input.reviewRequirement.linkedDependencyIds),
  };
}
