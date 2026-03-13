import { describe, expect, it } from 'vitest';

import { createOperatorDecisionRecord } from '../../mission-control/mission-decision-record.ts';

describe('mission decision record', () => {
  it('T-MR-D1 records approve decision deterministically', () => {
    const first = createOperatorDecisionRecord({
      missionRunId: 'run-1',
      reviewQueueEntryId: 'queue-1',
      decisionType: 'approve',
      reasonTokens: ['ok'],
    });

    const second = createOperatorDecisionRecord({
      missionRunId: 'run-1',
      reviewQueueEntryId: 'queue-1',
      decisionType: 'approve',
      reasonTokens: ['ok'],
    });

    expect(first.decisionOutcome).toBe('approved');
    expect(first.decisionRecordId).toBe(second.decisionRecordId);
  });

  it('T-MR-D2 records reject/defer/request_changes/force_review', () => {
    expect(createOperatorDecisionRecord({ missionRunId: 'run-1', reviewQueueEntryId: 'q1', decisionType: 'reject' }).decisionOutcome).toBe('rejected');
    expect(createOperatorDecisionRecord({ missionRunId: 'run-1', reviewQueueEntryId: 'q1', decisionType: 'defer' }).decisionOutcome).toBe('deferred');
    expect(createOperatorDecisionRecord({ missionRunId: 'run-1', reviewQueueEntryId: 'q1', decisionType: 'request_changes' }).decisionOutcome).toBe('changes_requested');
    expect(createOperatorDecisionRecord({ missionRunId: 'run-1', reviewQueueEntryId: 'q1', decisionType: 'force_review' }).decisionOutcome).toBe('review_escalated');
  });
});
