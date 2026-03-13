import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionPortfolioAttentionManager } from '../../mission-control/mission-portfolio-attention-manager.ts';
import { createMissionPortfolioAttentionProjection } from '../../mission-control/mission-portfolio-attention-projection.ts';
import type { MissionPortfolioProjection } from '../../mission-control/mission-portfolio-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-portfolio-attention-manager');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function portfolioProjection(): MissionPortfolioProjection {
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
    healthState: 'unstable',
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
      severity: 'critical',
      state: 'active',
    }],
    linkedEscalationSummaries: [{
      missionRunId: 'run-1',
      escalationId: 'esc-1',
      escalationClass: 'retry_exhaustion',
      severity: 'high',
      state: 'open',
    }],
    linkedDecisionSummaries: [],
    statusPreview: {},
    reportPreview: {},
  };
}

describe('mission portfolio attention manager', () => {
  it('T-MPA-M1 records acknowledge/defer/escalate/suppress as append-only actions', () => {
    const projection = createMissionPortfolioAttentionProjection({
      missionPortfolioProjection: {
        summarizeList: () => [{ missionPortfolioId: 'portfolio-1' }],
        projectOne: () => portfolioProjection(),
        projectAll: () => [portfolioProjection()],
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const manager = createMissionPortfolioAttentionManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    manager.acknowledgePortfolio({ missionPortfolioId: 'portfolio-1' });
    manager.deferPortfolio({ missionPortfolioId: 'portfolio-1' });
    manager.escalatePortfolio({ missionPortfolioId: 'portfolio-1' });
    const suppressed = manager.suppressPortfolioAttention({ missionPortfolioId: 'portfolio-1' });

    expect(suppressed.actionOutcome).toBe('suppressed');
    expect(suppressed.actionRecords.map((entry) => entry.actionType)).toContain('acknowledge');
    expect(suppressed.actionRecords.map((entry) => entry.actionType)).toContain('defer');
    expect(suppressed.actionRecords.map((entry) => entry.actionType)).toContain('escalate');
    expect(suppressed.actionRecords.map((entry) => entry.actionType)).toContain('suppress');
  });

  it('T-MPA-M2 force review can create attention when queue is absent', () => {
    const projection = createMissionPortfolioAttentionProjection({
      missionPortfolioProjection: {
        summarizeList: () => [{ missionPortfolioId: 'portfolio-1' }],
        projectOne: () => ({
          ...portfolioProjection(),
          readinessState: 'ready',
          healthState: 'healthy',
          governancePosture: 'clear',
          blockingClusters: [],
          priorityDistribution: {
            criticalMissionCount: 0,
            highMissionCount: 0,
            normalMissionCount: 1,
            lowMissionCount: 0,
            deferredMissionCount: 0,
            posture: 'priority_balanced',
          },
        }),
        projectAll: () => [],
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const manager = createMissionPortfolioAttentionManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const forced = manager.forcePortfolioReview({
      missionPortfolioId: 'portfolio-1',
      reasonTokens: ['manual_override'],
    });

    expect(forced.activeRequirementClasses).toContain('operator_forced_attention');
    expect(forced.actionOutcome).toBe('review_requested');
  });
});
