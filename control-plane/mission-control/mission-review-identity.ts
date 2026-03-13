import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  MissionDecisionType,
  MissionReviewRequirementClass,
} from './mission-review-types.ts';

function uniqueSorted(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function deriveMissionReviewQueueEntryId(input: {
  missionRunId: string;
  reviewRequirementClass: MissionReviewRequirementClass;
  queueCycle: number;
  reasonTokens?: string[];
  linkedEscalationIds?: string[];
  linkedDependencyIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionRunId: input.missionRunId,
    reviewRequirementClass: input.reviewRequirementClass,
    queueCycle: input.queueCycle,
    reasonTokens: uniqueSorted(input.reasonTokens),
    linkedEscalationIds: uniqueSorted(input.linkedEscalationIds),
    linkedDependencyIds: uniqueSorted(input.linkedDependencyIds),
  }));
}

export function deriveMissionDecisionRecordId(input: {
  missionRunId: string;
  reviewQueueEntryId: string;
  decisionType: MissionDecisionType;
  decisionOutcome: string;
  reasonTokens?: string[];
  linkedEscalationIds?: string[];
  linkedInterventionIds?: string[];
}): string {
  return sha256(canonicalStringify({
    missionRunId: input.missionRunId,
    reviewQueueEntryId: input.reviewQueueEntryId,
    decisionType: input.decisionType,
    decisionOutcome: input.decisionOutcome,
    reasonTokens: uniqueSorted(input.reasonTokens),
    linkedEscalationIds: uniqueSorted(input.linkedEscalationIds),
    linkedInterventionIds: uniqueSorted(input.linkedInterventionIds),
  }));
}

export function deriveMissionReviewHistoryEventDedupeKey(input: {
  missionRunId: string;
  eventType: string;
  reasonTokens?: string[];
  payload: Record<string, unknown>;
}): string {
  return sha256(canonicalStringify({
    missionRunId: input.missionRunId,
    eventType: input.eventType,
    reasonTokens: uniqueSorted(input.reasonTokens),
    payload: JSON.parse(canonicalStringify(input.payload)),
  }));
}
