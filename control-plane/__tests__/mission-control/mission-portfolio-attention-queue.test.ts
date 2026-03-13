import { describe, expect, it } from 'vitest';

import {
  deriveMissionPortfolioAttentionQueueEntry,
  selectPrimaryAttentionRequirement,
} from '../../mission-control/mission-portfolio-attention-queue.ts';
import type {
  MissionPortfolioAttentionRequirement,
  MissionPortfolioEscalation,
} from '../../mission-control/mission-portfolio-attention-types.ts';

const requirement: MissionPortfolioAttentionRequirement = {
  portfolioAttentionRequirementId: 'req-1',
  missionPortfolioId: 'portfolio-1',
  requirementClass: 'critical_blocking_cluster',
  severity: 'critical',
  reasonTokens: ['blocking_cluster_present'],
  linkedBlockingClusterIds: ['cluster-1'],
  linkedMissionRunIds: ['run-1'],
  linkedDecisionIds: [],
  state: 'active',
};

const escalation: MissionPortfolioEscalation = {
  portfolioEscalationId: 'esc-1',
  missionPortfolioId: 'portfolio-1',
  escalationClass: 'portfolio_blocked',
  severity: 'critical',
  reasonTokens: ['blocked'],
  linkedRequirementIds: ['req-1'],
  linkedMissionRunIds: ['run-1'],
  state: 'open',
};

describe('mission portfolio attention queue', () => {
  it('T-MPA-Q1 queue entry identity is deterministic across replay', () => {
    const first = deriveMissionPortfolioAttentionQueueEntry({
      missionPortfolioId: 'portfolio-1',
      attentionStatus: 'awaiting_attention',
      requirement,
      escalation,
      criticalMissionCount: 2,
      highMissionCount: 1,
      historyEntries: [],
    });

    const second = deriveMissionPortfolioAttentionQueueEntry({
      missionPortfolioId: 'portfolio-1',
      attentionStatus: 'awaiting_attention',
      requirement,
      escalation,
      criticalMissionCount: 2,
      highMissionCount: 1,
      historyEntries: [],
    });

    expect(first?.portfolioAttentionQueueEntryId).toBe(second?.portfolioAttentionQueueEntryId);
    expect(first?.queueState).toBe('queued');
  });

  it('T-MPA-Q2 queue closeout increments deterministic cycle identity', () => {
    const first = deriveMissionPortfolioAttentionQueueEntry({
      missionPortfolioId: 'portfolio-1',
      attentionStatus: 'awaiting_attention',
      requirement,
      escalation,
      criticalMissionCount: 2,
      highMissionCount: 1,
      historyEntries: [],
    });

    const second = deriveMissionPortfolioAttentionQueueEntry({
      missionPortfolioId: 'portfolio-1',
      attentionStatus: 'awaiting_attention',
      requirement,
      escalation,
      criticalMissionCount: 2,
      highMissionCount: 1,
      historyEntries: [{
        missionPortfolioId: 'portfolio-1',
        eventType: 'portfolio_attention_closed',
        eventDedupeKey: 'd-1',
        reasonTokens: ['closed'],
        payload: {
          queueEntry: {
            requirementClass: 'critical_blocking_cluster',
          },
        },
      }],
    });

    expect(first?.portfolioAttentionQueueEntryId).not.toBe(second?.portfolioAttentionQueueEntryId);
  });

  it('T-MPA-Q3 requirement precedence selects critical blocking first', () => {
    const selected = selectPrimaryAttentionRequirement({
      requirements: [
        {
          ...requirement,
          portfolioAttentionRequirementId: 'req-2',
          requirementClass: 'degraded_health_attention',
          severity: 'medium',
        },
        requirement,
      ],
    });

    expect(selected?.requirementClass).toBe('critical_blocking_cluster');
  });
});
