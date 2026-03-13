import { describe, expect, it } from 'vitest';

import { deriveMissionPortfolioBlockingClusters } from '../../mission-control/mission-portfolio-blocking.ts';

describe('mission portfolio blocking', () => {
  it('T-MP-B1 detects dependency blocking chains deterministically', () => {
    const clusters = deriveMissionPortfolioBlockingClusters({
      missionPortfolioId: 'portfolio-1',
      signals: [
        {
          missionRunId: 'run-2',
          coordinationState: 'blocked_by_dependency',
          governanceStatus: 'awaiting_review',
          priority: 'high',
          blockingMissionRunIds: ['run-1'],
          reasonTokens: ['upstream_blocked'],
        },
        {
          missionRunId: 'run-3',
          coordinationState: 'blocked_by_dependency',
          governanceStatus: 'approved',
          priority: 'normal',
          blockingMissionRunIds: ['run-1'],
          reasonTokens: ['upstream_blocked'],
        },
      ],
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.blockingMissionRunIds).toEqual(['run-1']);
    expect(clusters[0]?.blockedMissionRunIds).toEqual(['run-2', 'run-3']);
  });

  it('T-MP-B2 creates governance blocking cluster for rejected mission', () => {
    const clusters = deriveMissionPortfolioBlockingClusters({
      missionPortfolioId: 'portfolio-1',
      signals: [
        {
          missionRunId: 'run-9',
          coordinationState: 'active',
          governanceStatus: 'rejected',
          priority: 'critical',
          blockingMissionRunIds: [],
          reasonTokens: ['decision_rejected'],
        },
      ],
    });

    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.severity).toBe('critical');
    expect(clusters[0]?.reasonTokens).toContain('governance_decision_blocked');
  });
});
