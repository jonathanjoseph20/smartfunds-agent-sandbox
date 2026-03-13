import { describe, expect, it } from 'vitest';

import { createMissionReviewProjection } from '../../mission-control/mission-review-projection.ts';
import type { MissionCoordinationProjection } from '../../mission-control/mission-coordination.ts';
import type { MissionReviewHistoryStore } from '../../mission-control/mission-review-history-store.ts';
import type { MissionRunProjectionEngine } from '../../mission-control/mission-run-projection.ts';

function coordination(overrides: Partial<MissionCoordinationProjection> = {}): MissionCoordinationProjection {
  return {
    missionRunId: 'run-1',
    lifecycleState: 'active',
    coordinationState: 'active',
    priority: 'normal',
    activeInterventions: [],
    dependencySummaries: [],
    blockingMissionRunIds: [],
    blockedByEscalations: [],
    resumeEligibility: 'ineligible',
    lastLifecycleTransitionId: null,
    lastInterventionId: null,
    statusPreview: {},
    reportPreview: {},
    ...overrides,
  };
}

const missionRunProjection = {
  summarizeList: () => [{ missionRunId: 'run-1' }],
} as MissionRunProjectionEngine;

function store(entries: MissionReviewHistoryStore['load'] extends (...args: any[]) => infer R ? R['entries'] : never) {
  return {
    load: () => ({
      missionRunId: 'run-1',
      entries,
    }),
  } as MissionReviewHistoryStore;
}

describe('mission review projection', () => {
  it('T-MR-P1 approval projection resolves approved governance', () => {
    const projection = createMissionReviewProjection({
      missionRunProjection,
      missionCoordinationProjection: {
        projectOne: () => coordination({ blockedByEscalations: ['esc-1'], priority: 'critical' }),
      } as never,
      historyStore: store([
        {
          missionRunId: 'run-1',
          eventType: 'mission_decision_recorded',
          eventDedupeKey: '1',
          reasonTokens: [],
          payload: {
            decisionRecord: {
              decisionRecordId: 'd1',
              missionRunId: 'run-1',
              reviewQueueEntryId: 'q1',
              decisionType: 'approve',
              decisionOutcome: 'approved',
              reasonTokens: [],
              linkedEscalationIds: [],
              linkedInterventionIds: [],
              state: 'recorded',
            },
          },
        },
      ]),
    });

    const result = projection.projectOne({ missionRunId: 'run-1' });
    expect(result.governanceStatus).toBe('approved');
    expect(result.decisionOutcome).toBe('approved');
  });

  it('T-MR-P2 rejection precedence beats prior approval', () => {
    const projection = createMissionReviewProjection({
      missionRunProjection,
      missionCoordinationProjection: {
        projectOne: () => coordination({ blockedByEscalations: ['esc-1'], priority: 'critical' }),
      } as never,
      historyStore: store([
        {
          missionRunId: 'run-1',
          eventType: 'mission_decision_recorded',
          eventDedupeKey: '1',
          reasonTokens: [],
          payload: {
            decisionRecord: {
              decisionRecordId: 'd1',
              missionRunId: 'run-1',
              reviewQueueEntryId: 'q1',
              decisionType: 'approve',
              decisionOutcome: 'approved',
              reasonTokens: [],
              linkedEscalationIds: [],
              linkedInterventionIds: [],
              state: 'recorded',
            },
          },
        },
        {
          missionRunId: 'run-1',
          eventType: 'mission_decision_recorded',
          eventDedupeKey: '2',
          reasonTokens: [],
          payload: {
            decisionRecord: {
              decisionRecordId: 'd2',
              missionRunId: 'run-1',
              reviewQueueEntryId: 'q1',
              decisionType: 'reject',
              decisionOutcome: 'rejected',
              reasonTokens: [],
              linkedEscalationIds: [],
              linkedInterventionIds: [],
              state: 'recorded',
            },
          },
        },
      ]),
    });

    const result = projection.projectOne({ missionRunId: 'run-1' });
    expect(result.governanceStatus).toBe('rejected');
    expect(result.decisionOutcome).toBe('rejected');
  });

  it('T-MR-P3 defer and changes requested produce expected outcomes', () => {
    const deferProjection = createMissionReviewProjection({
      missionRunProjection,
      missionCoordinationProjection: {
        projectOne: () => coordination({ blockingMissionRunIds: ['run-upstream'] }),
      } as never,
      historyStore: store([
        {
          missionRunId: 'run-1',
          eventType: 'mission_decision_recorded',
          eventDedupeKey: 'd1',
          reasonTokens: [],
          payload: {
            decisionRecord: {
              decisionRecordId: 'd1',
              missionRunId: 'run-1',
              reviewQueueEntryId: 'q1',
              decisionType: 'defer',
              decisionOutcome: 'deferred',
              reasonTokens: [],
              linkedEscalationIds: [],
              linkedInterventionIds: [],
              state: 'recorded',
            },
          },
        },
      ]),
    });

    const changesProjection = createMissionReviewProjection({
      missionRunProjection,
      missionCoordinationProjection: {
        projectOne: () => coordination(),
      } as never,
      historyStore: store([
        {
          missionRunId: 'run-1',
          eventType: 'mission_decision_recorded',
          eventDedupeKey: 'c1',
          reasonTokens: [],
          payload: {
            decisionRecord: {
              decisionRecordId: 'c1',
              missionRunId: 'run-1',
              reviewQueueEntryId: 'q1',
              decisionType: 'request_changes',
              decisionOutcome: 'changes_requested',
              reasonTokens: [],
              linkedEscalationIds: [],
              linkedInterventionIds: [],
              state: 'recorded',
            },
          },
        },
      ]),
    });

    expect(deferProjection.projectOne({ missionRunId: 'run-1' }).governanceStatus).toBe('deferred');
    expect(changesProjection.projectOne({ missionRunId: 'run-1' }).governanceStatus).toBe('changes_requested');
  });
});
