import { describe, expect, it } from 'vitest';

import { deriveMissionPortfolioStabilization } from '../../mission-control/mission-portfolio-stabilization.ts';
import type { MissionPortfolioAttentionProjection } from '../../mission-control/mission-portfolio-attention-types.ts';
import type { MissionPortfolioResolutionHistoryEntry } from '../../mission-control/mission-portfolio-resolution-types.ts';

function attention(overrides: Partial<MissionPortfolioAttentionProjection> = {}): MissionPortfolioAttentionProjection {
  return {
    missionPortfolioId: 'portfolio-1',
    portfolioAttentionQueueEntryId: 'queue-1',
    attentionStatus: 'awaiting_attention',
    activeRequirementClasses: ['critical_blocking_cluster'],
    escalationSummaries: [],
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
      severity: 'high',
      reasonTokens: ['blocking'],
      linkedBlockingClusterIds: ['cluster-1'],
      linkedMissionRunIds: ['run-1'],
      linkedDecisionIds: [],
      state: 'active',
    }],
    escalations: [],
    queueEntry: null,
    actionRecords: [],
    statusPreview: {},
    reportPreview: {},
    ...overrides,
  };
}

function history(entries: MissionPortfolioResolutionHistoryEntry['eventType'][]): MissionPortfolioResolutionHistoryEntry[] {
  return entries.map((eventType, index) => ({
    missionPortfolioId: 'portfolio-1',
    eventType,
    eventDedupeKey: `${index}-${eventType}`,
    reasonTokens: [],
    payload: {},
  }));
}

describe('mission portfolio stabilization', () => {
  it('T-MPR-S1 derives not_stable', () => {
    const result = deriveMissionPortfolioStabilization({
      attention: attention(),
      resolutionHistory: history([]),
    });

    expect(result.stabilizationStatus).toBe('not_stable');
  });

  it('T-MPR-S2 derives stabilizing when no active instability remains', () => {
    const result = deriveMissionPortfolioStabilization({
      attention: attention({
        attentionStatus: 'no_attention_required',
        attentionRequirements: [],
        linkedBlockingClusters: [],
      }),
      resolutionHistory: history([]),
    });

    expect(result.stabilizationStatus).toBe('stabilizing');
  });

  it('T-MPR-S3 derives stable after mark_stable with no instability', () => {
    const result = deriveMissionPortfolioStabilization({
      attention: attention({
        attentionStatus: 'no_attention_required',
        attentionRequirements: [],
        linkedBlockingClusters: [],
      }),
      resolutionHistory: history(['portfolio_marked_stable']),
    });

    expect(result.stabilizationStatus).toBe('stable');
  });

  it('T-MPR-S4 derives regressed when instability returns after mark_stable', () => {
    const result = deriveMissionPortfolioStabilization({
      attention: attention(),
      resolutionHistory: history(['portfolio_marked_stable']),
    });

    expect(result.stabilizationStatus).toBe('regressed');
  });

  it('T-MPR-S5 derives inconclusive for inconclusive attention input', () => {
    const result = deriveMissionPortfolioStabilization({
      attention: attention({ attentionStatus: 'inconclusive' }),
      resolutionHistory: history([]),
    });

    expect(result.stabilizationStatus).toBe('inconclusive');
  });
});
