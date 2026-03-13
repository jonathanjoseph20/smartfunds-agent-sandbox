import type {
  MissionDecisionOutcome,
  MissionGovernanceStatus,
  MissionReviewQueueState,
  MissionReviewRequirement,
} from './mission-review-types.ts';

export function deriveMissionGovernanceStatus(input: {
  decisionOutcome: MissionDecisionOutcome;
  queueState: MissionReviewQueueState | null;
  reviewRequirements: MissionReviewRequirement[];
}): MissionGovernanceStatus {
  if (input.decisionOutcome === 'rejected') {
    return 'rejected';
  }

  if (input.decisionOutcome === 'approved') {
    return 'approved';
  }

  if (input.decisionOutcome === 'changes_requested') {
    return 'changes_requested';
  }

  if (input.decisionOutcome === 'deferred' || input.queueState === 'deferred') {
    return 'deferred';
  }

  if (input.decisionOutcome === 'review_escalated') {
    return 'escalated_for_decision';
  }

  if (input.decisionOutcome === 'inconclusive') {
    return 'inconclusive';
  }

  if (input.reviewRequirements.length === 0) {
    return 'no_review_required';
  }

  if (input.queueState === 'under_review') {
    return 'under_review';
  }

  if (input.queueState === 'decision_recorded') {
    return 'under_review';
  }

  if (input.queueState === 'closed') {
    return 'awaiting_review';
  }

  return 'awaiting_review';
}
