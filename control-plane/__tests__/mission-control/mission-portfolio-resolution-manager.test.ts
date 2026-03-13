import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionPortfolioResolutionManager } from '../../mission-control/mission-portfolio-resolution-manager.ts';
import { createMissionPortfolioResolutionProjection } from '../../mission-control/mission-portfolio-resolution-projection.ts';
import type { MissionPortfolioAttentionProjection } from '../../mission-control/mission-portfolio-attention-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-portfolio-resolution-manager');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function attention(overrides: Partial<MissionPortfolioAttentionProjection> = {}): MissionPortfolioAttentionProjection {
  return {
    missionPortfolioId: 'portfolio-1',
    portfolioAttentionQueueEntryId: 'a-queue-1',
    attentionStatus: 'awaiting_attention',
    activeRequirementClasses: ['critical_blocking_cluster'],
    escalationSummaries: [{
      portfolioEscalationId: 'esc-1',
      escalationClass: 'portfolio_blocked',
      severity: 'high',
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

describe('mission portfolio resolution manager', () => {
  it('T-MPR-M1 records append-only action history across all action types', () => {
    const projection = createMissionPortfolioResolutionProjection({
      attentionProjection: {
        projectOne: () => attention(),
        projectAll: () => [attention()],
        listAttentionQueue: () => [],
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const manager = createMissionPortfolioResolutionManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    manager.requestPortfolioResolutionReview({ missionPortfolioId: 'portfolio-1' });
    manager.markPortfolioStable({ missionPortfolioId: 'portfolio-1' });
    manager.markPortfolioResolved({ missionPortfolioId: 'portfolio-1' });
    manager.deferPortfolioClosure({ missionPortfolioId: 'portfolio-1' });
    manager.closePortfolio({ missionPortfolioId: 'portfolio-1' });
    manager.reopenPortfolio({ missionPortfolioId: 'portfolio-1' });
    const archived = manager.archivePortfolio({ missionPortfolioId: 'portfolio-1' });

    expect(archived.actionRecords.map((entry) => entry.actionType)).toContain('request_resolution_review');
    expect(archived.actionRecords.map((entry) => entry.actionType)).toContain('mark_stable');
    expect(archived.actionRecords.map((entry) => entry.actionType)).toContain('mark_resolved');
    expect(archived.actionRecords.map((entry) => entry.actionType)).toContain('defer_closure');
    expect(archived.actionRecords.map((entry) => entry.actionType)).toContain('close');
    expect(archived.actionRecords.map((entry) => entry.actionType)).toContain('reopen');
    expect(archived.actionRecords.map((entry) => entry.actionType)).toContain('archive');
  });
});
