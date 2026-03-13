import { describe, expect, it } from 'vitest';

import { createMissionPortfolioAttentionProjection } from '../../mission-control/mission-portfolio-attention-projection.ts';
import type { MissionPortfolioAttentionHistoryStore } from '../../mission-control/mission-portfolio-attention-history-store.ts';
import type { MissionPortfolioProjection } from '../../mission-control/mission-portfolio-types.ts';

function portfolio(overrides: Partial<MissionPortfolioProjection> = {}): MissionPortfolioProjection {
  return {
    missionPortfolioId: 'portfolio-1',
    displayName: 'Portfolio 1',
    portfolioType: 'coordination_portfolio',
    missionRunIds: ['run-1'],
    memberships: [],
    membershipSummaries: {
      totalMembershipCount: 1,
      activeMembershipCount: 1,
      membershipClassCounts: {
        shared_objective: 0,
        shared_dependency_chain: 0,
        shared_governance_track: 0,
        shared_priority_band: 1,
        explicit_portfolio_membership: 0,
        shared_operating_domain: 0,
      },
    },
    readinessState: 'blocked',
    healthState: 'degraded',
    governancePosture: 'mixed',
    priorityDistribution: {
      criticalMissionCount: 1,
      highMissionCount: 0,
      normalMissionCount: 0,
      lowMissionCount: 0,
      deferredMissionCount: 0,
      posture: 'critical_overload',
    },
    blockingClusters: [{
      portfolioBlockingClusterId: 'cluster-1',
      missionPortfolioId: 'portfolio-1',
      blockingMissionRunIds: ['run-upstream'],
      blockedMissionRunIds: ['run-1'],
      reasonTokens: ['dependency'],
      severity: 'high',
      state: 'active',
    }],
    linkedEscalationSummaries: [{
      missionRunId: 'run-1',
      escalationId: 'm-esc-1',
      escalationClass: 'terminal_node_failure',
      severity: 'high',
      state: 'open',
    }],
    linkedDecisionSummaries: [],
    statusPreview: {},
    reportPreview: {},
    ...overrides,
  };
}

function store(entries: MissionPortfolioAttentionHistoryStore['getEvents'] extends (...args: any[]) => infer R ? R : never) {
  return {
    getEvents: () => entries,
  } as MissionPortfolioAttentionHistoryStore;
}

describe('mission portfolio attention projection', () => {
  it('T-MPA-P1 action replay stability and attention state transitions', () => {
    const historyEntries = [
      {
        missionPortfolioId: 'portfolio-1',
        eventType: 'portfolio_operator_action_recorded',
        eventDedupeKey: '1',
        reasonTokens: ['requested_by:operator'],
        payload: {
          actionRecord: {
            portfolioOperatorActionRecordId: 'action-1',
            missionPortfolioId: 'portfolio-1',
            portfolioAttentionQueueEntryId: 'queue-1',
            actionType: 'defer',
            reasonTokens: [],
            linkedEscalationIds: [],
            linkedRequirementIds: [],
            state: 'recorded',
          },
        },
      },
    ] as const;

    const projection = createMissionPortfolioAttentionProjection({
      missionPortfolioProjection: {
        summarizeList: () => [{ missionPortfolioId: 'portfolio-1' }],
        projectOne: () => portfolio(),
        projectAll: () => [portfolio()],
      } as never,
      historyStore: store([...historyEntries]) as never,
    });

    const first = projection.projectOne({ missionPortfolioId: 'portfolio-1' });
    const second = projection.projectOne({ missionPortfolioId: 'portfolio-1' });

    expect(second).toEqual(first);
    expect(first.attentionStatus).toBe('deferred');
    expect(first.actionOutcome).toBe('deferred');
  });

  it('T-MPA-P2 preserves blocking clusters and priority distribution', () => {
    const projection = createMissionPortfolioAttentionProjection({
      missionPortfolioProjection: {
        summarizeList: () => [{ missionPortfolioId: 'portfolio-1' }],
        projectOne: () => portfolio(),
        projectAll: () => [portfolio()],
      } as never,
      historyStore: store([] as never),
    });

    const result = projection.projectOne({ missionPortfolioId: 'portfolio-1' });

    expect(result.linkedBlockingClusters).toContain('cluster-1');
    expect(result.priorityDistribution.posture).toBe('critical_overload');
    expect(result.linkedMissionEscalations[0]?.escalationId).toBe('m-esc-1');
  });

  it('T-MPA-P3 queue ordering deterministic by severity, priority, portfolio id', () => {
    const projection = createMissionPortfolioAttentionProjection({
      missionPortfolioProjection: {
        summarizeList: () => [{ missionPortfolioId: 'portfolio-a' }, { missionPortfolioId: 'portfolio-b' }],
        projectOne: ({ missionPortfolioId }) => portfolio({
          missionPortfolioId,
          blockingClusters: [{
            portfolioBlockingClusterId: `cluster-${missionPortfolioId}`,
            missionPortfolioId,
            blockingMissionRunIds: ['run-upstream'],
            blockedMissionRunIds: ['run-1'],
            reasonTokens: ['dependency'],
            severity: missionPortfolioId === 'portfolio-a' ? 'critical' : 'high',
            state: 'active',
          }],
        }),
        projectAll: () => [
          portfolio({ missionPortfolioId: 'portfolio-a' }),
          portfolio({ missionPortfolioId: 'portfolio-b' }),
        ],
      } as never,
      historyStore: store([] as never),
    });

    const queue = projection.listAttentionQueue();
    expect(queue[0]?.missionPortfolioId).toBe('portfolio-a');
    expect(queue[1]?.missionPortfolioId).toBe('portfolio-b');
  });
});
