import { deriveMissionDecisionRecordId } from './mission-review-identity.ts';
import type {
  MissionDecisionType,
  OperatorDecisionRecord,
} from './mission-review-types.ts';

function uniqueSorted(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function mapDecisionTypeToOutcome(decisionType: MissionDecisionType): OperatorDecisionRecord['decisionOutcome'] {
  if (decisionType === 'approve') {
    return 'approved';
  }
  if (decisionType === 'reject') {
    return 'rejected';
  }
  if (decisionType === 'defer') {
    return 'deferred';
  }
  if (decisionType === 'request_changes') {
    return 'changes_requested';
  }
  if (decisionType === 'force_review' || decisionType === 'escalate') {
    return 'review_escalated';
  }
  return 'inconclusive';
}

export function createOperatorDecisionRecord(input: {
  missionRunId: string;
  reviewQueueEntryId: string;
  decisionType: MissionDecisionType;
  reasonTokens?: string[];
  linkedEscalationIds?: string[];
  linkedInterventionIds?: string[];
}): OperatorDecisionRecord {
  const reasonTokens = uniqueSorted(input.reasonTokens);
  const linkedEscalationIds = uniqueSorted(input.linkedEscalationIds);
  const linkedInterventionIds = uniqueSorted(input.linkedInterventionIds);
  const decisionOutcome = mapDecisionTypeToOutcome(input.decisionType);

  return {
    decisionRecordId: deriveMissionDecisionRecordId({
      missionRunId: input.missionRunId,
      reviewQueueEntryId: input.reviewQueueEntryId,
      decisionType: input.decisionType,
      decisionOutcome,
      reasonTokens,
      linkedEscalationIds,
      linkedInterventionIds,
    }),
    missionRunId: input.missionRunId,
    reviewQueueEntryId: input.reviewQueueEntryId,
    decisionType: input.decisionType,
    decisionOutcome,
    reasonTokens,
    linkedEscalationIds,
    linkedInterventionIds,
    state: 'recorded',
  };
}
