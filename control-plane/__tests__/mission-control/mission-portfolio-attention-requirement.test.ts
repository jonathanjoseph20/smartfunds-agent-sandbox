import { describe, expect, it } from 'vitest';

import { deriveMissionPortfolioAttentionRequirements } from '../../mission-control/mission-portfolio-attention-requirement.ts';
import type { MissionPortfolioProjection } from '../../mission-control/mission-portfolio-types.ts';

function portfolio(overrides: Partial<MissionPortfolioProjection> = {}): MissionPortfolioProjection {
  return {
    missionPortfolioId: 'portfolio-1',
    displayName: 'Portfolio 1',
    portfolioType: 'coordination_portfolio',
    missionRunIds: ['run-1', 'run-2'],
    memberships: [],
    membershipSummaries: {
      totalMembershipCount: 2,
      activeMembershipCount: 2,
      membershipClassCounts: {
        shared_objective: 0,
        shared_dependency_chain: 0,
        shared_governance_track: 0,
        shared_priority_band: 2,
        explicit_portfolio_membership: 0,
        shared_operating_domain: 0,
      },
    },
    readinessState: 'ready',
    healthState: 'healthy',
    governancePosture: 'clear',
    priorityDistribution: {
      criticalMissionCount: 0,
      highMissionCount: 1,
      normalMissionCount: 1,
      lowMissionCount: 0,
      deferredMissionCount: 0,
      posture: 'priority_balanced',
    },
    blockingClusters: [],
    linkedEscalationSummaries: [],
    linkedDecisionSummaries: [],
    statusPreview: {},
    reportPreview: {},
    ...overrides,
  };
}

describe('mission portfolio attention requirement', () => {
  it('T-MPA-R1 derives critical blocking cluster and governance mixed attention', () => {
    const requirements = deriveMissionPortfolioAttentionRequirements({
      portfolio: portfolio({
        governancePosture: 'mixed',
        blockingClusters: [{
          portfolioBlockingClusterId: 'cluster-1',
          missionPortfolioId: 'portfolio-1',
          blockingMissionRunIds: ['run-upstream'],
          blockedMissionRunIds: ['run-1'],
          reasonTokens: ['dependency'],
          severity: 'critical',
          state: 'active',
        }],
      }),
      forceAttentionRequested: false,
    });

    expect(requirements.map((entry) => entry.requirementClass)).toContain('critical_blocking_cluster');
    expect(requirements.map((entry) => entry.requirementClass)).toContain('governance_mixed_attention');
  });

  it('T-MPA-R2 derives degraded health and operator forced attention', () => {
    const requirements = deriveMissionPortfolioAttentionRequirements({
      portfolio: portfolio({
        healthState: 'degraded',
      }),
      forceAttentionRequested: true,
    });

    expect(requirements.map((entry) => entry.requirementClass)).toContain('degraded_health_attention');
    expect(requirements.map((entry) => entry.requirementClass)).toContain('operator_forced_attention');
  });

  it('T-MPA-R3 dedupes deterministic requirements and keeps inconclusive explicit', () => {
    const requirements = deriveMissionPortfolioAttentionRequirements({
      portfolio: portfolio({
        readinessState: 'inconclusive',
        healthState: 'inconclusive',
        governancePosture: 'inconclusive',
      }),
      forceAttentionRequested: false,
    });

    const ids = requirements.map((entry) => entry.portfolioAttentionRequirementId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(requirements.map((entry) => entry.requirementClass)).toContain('inconclusive_attention');
  });
});
