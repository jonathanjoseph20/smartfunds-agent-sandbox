import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionReviewHistoryStore } from '../../mission-control/mission-review-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-review-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission review history store', () => {
  it('T-MR-H1 append-only dedupe is deterministic', () => {
    const store = createMissionReviewHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.appendReviewEvent({
      missionRunId: 'run-1',
      eventType: 'mission_review_queued',
      reasonTokens: ['priority:high'],
      payload: {
        reviewQueueEntryId: 'queue-1',
      },
    });

    const second = store.appendReviewEvent({
      missionRunId: 'run-1',
      eventType: 'mission_review_queued',
      reasonTokens: ['priority:high'],
      payload: {
        reviewQueueEntryId: 'queue-1',
      },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MR-H2 replay ordering is stable', () => {
    const store = createMissionReviewHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.appendReviewEvent({
      missionRunId: 'run-1',
      eventType: 'mission_review_queued',
      payload: { reviewQueueEntryId: 'queue-1' },
    });

    store.appendDecisionEvent({
      missionRunId: 'run-1',
      eventType: 'mission_decision_recorded',
      payload: {
        decisionRecord: {
          decisionRecordId: 'd1',
          missionRunId: 'run-1',
          reviewQueueEntryId: 'queue-1',
          decisionType: 'approve',
          decisionOutcome: 'approved',
          reasonTokens: [],
          linkedEscalationIds: [],
          linkedInterventionIds: [],
          state: 'recorded',
        },
      },
    });

    expect(store.replay({ missionRunId: 'run-1' }).map((entry) => entry.eventType)).toEqual([
      'mission_review_queued',
      'mission_decision_recorded',
    ]);
  });
});
