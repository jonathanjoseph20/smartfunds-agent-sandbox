import { describe, expect, it } from 'vitest';

import { deriveMissionReviewQueueEntry, selectPrimaryReviewRequirement } from '../../mission-control/mission-review-queue.ts';

const requirement = {
  missionRunId: 'run-1',
  reviewRequirementClass: 'critical_escalation_review' as const,
  reasonTokens: ['critical_escalation_present'],
  linkedEscalationIds: ['esc-1'],
  linkedDependencyIds: [],
  priority: 'critical' as const,
};

describe('mission review queue', () => {
  it('T-MR-Q1 deterministic queue identity across replays', () => {
    const first = deriveMissionReviewQueueEntry({
      missionRunId: 'run-1',
      reviewRequirement: requirement,
      governanceStatus: 'awaiting_review',
      historyEntries: [],
    });

    const second = deriveMissionReviewQueueEntry({
      missionRunId: 'run-1',
      reviewRequirement: requirement,
      governanceStatus: 'awaiting_review',
      historyEntries: [],
    });

    expect(first?.reviewQueueEntryId).toBe(second?.reviewQueueEntryId);
    expect(first?.queueState).toBe('queued');
  });

  it('T-MR-Q2 queue closeout yields new deterministic cycle identity', () => {
    const first = deriveMissionReviewQueueEntry({
      missionRunId: 'run-1',
      reviewRequirement: requirement,
      governanceStatus: 'awaiting_review',
      historyEntries: [],
    });

    const second = deriveMissionReviewQueueEntry({
      missionRunId: 'run-1',
      reviewRequirement: requirement,
      governanceStatus: 'awaiting_review',
      historyEntries: [{
        missionRunId: 'run-1',
        eventType: 'mission_review_closed',
        eventDedupeKey: 'dedupe-1',
        reasonTokens: ['closed'],
        payload: {
          queueEntry: {
            reviewRequirementClass: 'critical_escalation_review',
          },
        },
      }],
    });

    expect(first?.reviewQueueEntryId).not.toBe(second?.reviewQueueEntryId);
  });

  it('T-MR-Q3 select primary requirement follows bounded precedence', () => {
    const selected = selectPrimaryReviewRequirement({
      reviewRequirements: [
        { ...requirement, reviewRequirementClass: 'priority_review', reasonTokens: ['priority:high'], priority: 'high' },
        requirement,
      ],
    });

    expect(selected?.reviewRequirementClass).toBe('critical_escalation_review');
  });
});
