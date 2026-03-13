import { describe, expect, it } from 'vitest';

import { deriveMissionPortfolioResolutionStatus } from '../../mission-control/mission-portfolio-resolution-status.ts';
import type { MissionPortfolioAttentionProjection } from '../../mission-control/mission-portfolio-attention-types.ts';
import type { PortfolioResolutionActionRecord } from '../../mission-control/mission-portfolio-resolution-types.ts';

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
    escalations: [{
      portfolioEscalationId: 'esc-1',
      missionPortfolioId: 'portfolio-1',
      escalationClass: 'portfolio_blocked',
      severity: 'high',
      reasonTokens: [],
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

function action(actionType: PortfolioResolutionActionRecord['actionType']): PortfolioResolutionActionRecord {
  return {
    portfolioResolutionActionRecordId: `action-${actionType}`,
    missionPortfolioId: 'portfolio-1',
    portfolioResolutionQueueEntryId: 'queue-1',
    actionType,
    reasonTokens: [],
    linkedRequirementIds: [],
    linkedEscalationIds: [],
    actionOutcome: 'pending',
    actor: 'operator',
    state: 'recorded',
  };
}

describe('mission portfolio resolution status', () => {
  it('T-MPR-R1 derives unresolved', () => {
    const result = deriveMissionPortfolioResolutionStatus({
      attention: attention(),
      actionRecords: [],
    });

    expect(result.resolutionStatus).toBe('unresolved');
  });

  it('T-MPR-R2 derives partially_resolved', () => {
    const result = deriveMissionPortfolioResolutionStatus({
      attention: attention(),
      actionRecords: [action('mark_stable')],
    });

    expect(result.resolutionStatus).toBe('partially_resolved');
  });

  it('T-MPR-R3 derives resolved when resolved action and no unresolved signals', () => {
    const result = deriveMissionPortfolioResolutionStatus({
      attention: attention({
        attentionStatus: 'no_attention_required',
        attentionRequirements: [],
        escalations: [],
      }),
      actionRecords: [action('mark_resolved')],
    });

    expect(result.resolutionStatus).toBe('resolved');
  });

  it('T-MPR-R4 derives reopened when latest action is reopen', () => {
    const result = deriveMissionPortfolioResolutionStatus({
      attention: attention({
        attentionStatus: 'no_attention_required',
        attentionRequirements: [],
        escalations: [],
      }),
      actionRecords: [action('mark_resolved'), action('reopen')],
    });

    expect(result.resolutionStatus).toBe('reopened');
  });

  it('T-MPR-R5 derives inconclusive for inconclusive inputs', () => {
    const result = deriveMissionPortfolioResolutionStatus({
      attention: attention({ attentionStatus: 'inconclusive' }),
      actionRecords: [],
    });

    expect(result.resolutionStatus).toBe('inconclusive');
  });
});
