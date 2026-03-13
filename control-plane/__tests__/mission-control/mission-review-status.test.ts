import { describe, expect, it } from 'vitest';

import { deriveMissionDecisionOutcome } from '../../mission-control/mission-decision-outcome.ts';
import { createOperatorDecisionRecord } from '../../mission-control/mission-decision-record.ts';
import { deriveMissionGovernanceStatus } from '../../mission-control/mission-review-status.ts';

function record(decisionType: 'approve' | 'reject' | 'defer' | 'request_changes' | 'force_review') {
  return createOperatorDecisionRecord({
    missionRunId: 'run-1',
    reviewQueueEntryId: 'queue-1',
    decisionType,
  });
}

describe('mission review status precedence', () => {
  it('T-MR-S1 governance precedence resolves terminal outcomes first', () => {
    expect(deriveMissionGovernanceStatus({
      decisionOutcome: 'approved',
      queueState: 'under_review',
      reviewRequirements: [{
        missionRunId: 'run-1',
        reviewRequirementClass: 'critical_escalation_review',
        reasonTokens: ['x'],
        linkedEscalationIds: ['e1'],
        linkedDependencyIds: [],
        priority: 'critical',
      }],
    })).toBe('approved');

    expect(deriveMissionGovernanceStatus({
      decisionOutcome: 'rejected',
      queueState: 'awaiting_review',
      reviewRequirements: [],
    })).toBe('rejected');
  });

  it('T-MR-S2 decision outcome precedence is deterministic for conflicts', () => {
    const outcome = deriveMissionDecisionOutcome({
      decisionRecords: [record('approve'), record('request_changes'), record('reject')],
    });

    expect(outcome.decisionOutcome).toBe('rejected');
    expect(outcome.activeDecisionRecordId).toBeTruthy();
  });

  it('T-MR-S3 pending/no requirement resolves no_review_required', () => {
    expect(deriveMissionGovernanceStatus({
      decisionOutcome: 'pending',
      queueState: null,
      reviewRequirements: [],
    })).toBe('no_review_required');
  });

  it('T-MR-S4 pending with requirement resolves awaiting_review', () => {
    expect(deriveMissionGovernanceStatus({
      decisionOutcome: 'pending',
      queueState: 'queued',
      reviewRequirements: [{
        missionRunId: 'run-1',
        reviewRequirementClass: 'priority_review',
        reasonTokens: ['priority:high'],
        linkedEscalationIds: [],
        linkedDependencyIds: [],
        priority: 'high',
      }],
    })).toBe('awaiting_review');
  });
});
