import { describe, expect, it } from 'vitest';

import { createMissionPortfolioResolutionProjection } from '../../mission-control/mission-portfolio-resolution-projection.ts';
import type { MissionPortfolioAttentionProjection } from '../../mission-control/mission-portfolio-attention-types.ts';
import type { MissionPortfolioResolutionHistoryStore } from '../../mission-control/mission-portfolio-resolution-history-store.ts';

function attention(overrides: Partial<MissionPortfolioAttentionProjection> = {}): MissionPortfolioAttentionProjection {
  return {
    missionPortfolioId: 'portfolio-1',
    portfolioAttentionQueueEntryId: 'a-queue-1',
    attentionStatus: 'awaiting_attention',
    activeRequirementClasses: ['critical_blocking_cluster'],
    escalationSummaries: [{
      portfolioEscalationId: 'esc-1',
      escalationClass: 'portfolio_blocked',
      severity: 'critical',
      state: 'open',
    }],
    actionOutcome: 'pending',
    priorityDistribution: {
      criticalMissionCount: 1,
      highMissionCount: 0,
      normalMissionCount: 0,
      lowMissionCount: 0,
      deferredMissionCount: 0,
      posture: 'critical_overload',
    },
    linkedBlockingClusters: ['cluster-1'],
    linkedMissionEscalations: [],
    activeActionRecordId: null,
    actionHistory: [],
    attentionRequirements: [{
      portfolioAttentionRequirementId: 'req-1',
      missionPortfolioId: 'portfolio-1',
      requirementClass: 'critical_blocking_cluster',
      severity: 'critical',
      reasonTokens: ['blocking'],
      linkedBlockingClusterIds: ['cluster-1'],
      linkedMissionRunIds: ['run-1'],
      linkedDecisionIds: [],
      state: 'active',
    }],
    escalations: [{
      portfolioEscalationId: 'esc-1',
      missionPortfolioId: 'portfolio-1',
      escalationClass: 'portfolio_blocked',
      severity: 'critical',
      reasonTokens: ['blocking'],
      linkedRequirementIds: ['req-1'],
      linkedMissionRunIds: ['run-1'],
      state: 'open',
    }],
    queueEntry: null,
    actionRecords: [],
    statusPreview: {},
    reportPreview: {},
    ...overrides,
  };
}

function store(entries: MissionPortfolioResolutionHistoryStore['replay'] extends (...args: any[]) => infer R ? R : never) {
  return {
    replay: () => entries,
  } as MissionPortfolioResolutionHistoryStore;
}

describe('mission portfolio resolution projection', () => {
  it('T-MPR-P1 replay determinism from history store', () => {
    const historyEntries = [{
      missionPortfolioId: 'portfolio-1',
      eventType: 'portfolio_marked_stable',
      eventDedupeKey: 'event-1',
      reasonTokens: ['requested_by:operator'],
      payload: {
        actionRecord: {
          portfolioResolutionActionRecordId: 'ra-1',
          missionPortfolioId: 'portfolio-1',
          portfolioResolutionQueueEntryId: 'rq-1',
          actionType: 'mark_stable',
          reasonTokens: [],
          linkedRequirementIds: [],
          linkedEscalationIds: [],
          actionOutcome: 'stabilized',
          actor: 'operator',
          state: 'recorded',
        },
      },
    }] as const;

    const projection = createMissionPortfolioResolutionProjection({
      attentionProjection: {
        projectOne: () => attention(),
        projectAll: () => [attention()],
        listAttentionQueue: () => [],
      } as never,
      historyStore: store([...historyEntries]) as never,
    });

    const first = projection.projectOne({ missionPortfolioId: 'portfolio-1' });
    const second = projection.projectOne({ missionPortfolioId: 'portfolio-1' });

    expect(second).toEqual(first);
    expect(first.stabilizationStatus).toBe('regressed');
  });

  it('T-MPR-P2 deterministic queue ordering by state, priority, id', () => {
    const projection = createMissionPortfolioResolutionProjection({
      attentionProjection: {
        projectOne: ({ missionPortfolioId }: { missionPortfolioId: string }) => attention({
          missionPortfolioId,
          priorityDistribution: {
            criticalMissionCount: missionPortfolioId === 'portfolio-a' ? 2 : 1,
            highMissionCount: 0,
            normalMissionCount: 0,
            lowMissionCount: 0,
            deferredMissionCount: 0,
            posture: 'critical_overload',
          },
        }),
        projectAll: () => [attention({ missionPortfolioId: 'portfolio-a' }), attention({ missionPortfolioId: 'portfolio-b' })],
        listAttentionQueue: () => [],
      } as never,
      historyStore: store([] as never),
    });

    const queue = projection.listResolutionQueue();
    expect(queue[0]?.missionPortfolioId).toBe('portfolio-a');
    expect(queue[1]?.missionPortfolioId).toBe('portfolio-b');
  });

  it('T-MPR-P3 queue entry id remains stable for same projection inputs', () => {
    const projection = createMissionPortfolioResolutionProjection({
      attentionProjection: {
        projectOne: () => attention(),
        projectAll: () => [attention()],
        listAttentionQueue: () => [],
      } as never,
      historyStore: store([] as never),
    });

    const first = projection.projectOne({ missionPortfolioId: 'portfolio-1' }).queueEntry?.portfolioResolutionQueueEntryId;
    const second = projection.projectOne({ missionPortfolioId: 'portfolio-1' }).queueEntry?.portfolioResolutionQueueEntryId;

    expect(second).toBe(first);
  });
});
