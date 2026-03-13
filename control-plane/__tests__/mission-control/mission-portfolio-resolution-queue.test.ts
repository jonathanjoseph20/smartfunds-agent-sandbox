import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionPortfolioResolutionHistoryStore } from '../../mission-control/mission-portfolio-resolution-history-store.ts';
import { createMissionPortfolioResolutionProjection } from '../../mission-control/mission-portfolio-resolution-projection.ts';
import type { MissionPortfolioAttentionProjection } from '../../mission-control/mission-portfolio-attention-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-portfolio-resolution-queue');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function attention(missionPortfolioId: string, critical: number): MissionPortfolioAttentionProjection {
  return {
    missionPortfolioId,
    portfolioAttentionQueueEntryId: `aq-${missionPortfolioId}`,
    attentionStatus: 'awaiting_attention',
    activeRequirementClasses: ['critical_blocking_cluster'],
    escalationSummaries: [{
      portfolioEscalationId: `esc-${missionPortfolioId}`,
      escalationClass: 'portfolio_blocked',
      severity: critical > 1 ? 'critical' : 'high',
      state: 'open',
    }],
    actionOutcome: 'pending',
    priorityDistribution: {
      criticalMissionCount: critical,
      highMissionCount: 0,
      normalMissionCount: 0,
      lowMissionCount: 0,
      deferredMissionCount: 0,
      posture: 'critical_overload',
    },
    linkedBlockingClusters: [`cluster-${missionPortfolioId}`],
    linkedMissionEscalations: [],
    activeActionRecordId: null,
    actionHistory: [],
    attentionRequirements: [{
      portfolioAttentionRequirementId: `req-${missionPortfolioId}`,
      missionPortfolioId,
      requirementClass: 'critical_blocking_cluster',
      severity: critical > 1 ? 'critical' : 'high',
      reasonTokens: ['blocking'],
      linkedBlockingClusterIds: [`cluster-${missionPortfolioId}`],
      linkedMissionRunIds: ['run-1'],
      linkedDecisionIds: [],
      state: 'active',
    }],
    escalations: [{
      portfolioEscalationId: `esc-${missionPortfolioId}`,
      missionPortfolioId,
      escalationClass: 'portfolio_blocked',
      severity: critical > 1 ? 'critical' : 'high',
      reasonTokens: ['blocking'],
      linkedRequirementIds: [`req-${missionPortfolioId}`],
      linkedMissionRunIds: ['run-1'],
      state: 'open',
    }],
    queueEntry: null,
    actionRecords: [],
    statusPreview: {},
    reportPreview: {},
  };
}

describe('mission portfolio resolution queue', () => {
  it('T-MPR-Q1 deterministic ordering and queue creation', () => {
    const projection = createMissionPortfolioResolutionProjection({
      attentionProjection: {
        projectOne: ({ missionPortfolioId }: { missionPortfolioId: string }) => attention(
          missionPortfolioId,
          missionPortfolioId === 'portfolio-a' ? 3 : 1
        ),
        projectAll: () => [attention('portfolio-a', 3), attention('portfolio-b', 1)],
        listAttentionQueue: () => [],
      } as never,
    });

    const queue = projection.listResolutionQueue();

    expect(queue.length).toBe(2);
    expect(queue[0]?.missionPortfolioId).toBe('portfolio-a');
    expect(queue[1]?.missionPortfolioId).toBe('portfolio-b');
  });

  it('T-MPR-Q2 duplicate prevention via history dedupe and stable queue id', () => {
    const historyStore = createMissionPortfolioResolutionHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = historyStore.appendEvent({
      missionPortfolioId: 'portfolio-1',
      eventType: 'portfolio_resolution_started',
      reasonTokens: ['a'],
      payload: { missionPortfolioId: 'portfolio-1' },
    });
    const second = historyStore.appendEvent({
      missionPortfolioId: 'portfolio-1',
      eventType: 'portfolio_resolution_started',
      reasonTokens: ['a'],
      payload: { missionPortfolioId: 'portfolio-1' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);

    const projection = createMissionPortfolioResolutionProjection({
      attentionProjection: {
        projectOne: () => attention('portfolio-1', 1),
        projectAll: () => [attention('portfolio-1', 1)],
        listAttentionQueue: () => [],
      } as never,
      historyStore,
    });

    const one = projection.projectOne({ missionPortfolioId: 'portfolio-1' }).portfolioResolutionQueueEntryId;
    const two = projection.projectOne({ missionPortfolioId: 'portfolio-1' }).portfolioResolutionQueueEntryId;

    expect(two).toBe(one);
  });
});
