import { describe, expect, it } from 'vitest';

import { deriveMissionPortfolioAttentionRequirements } from '../../mission-control/mission-portfolio-attention-requirement.ts';
import { deriveMissionPortfolioEscalations } from '../../mission-control/mission-portfolio-escalation.ts';
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
    readinessState: 'blocked',
    healthState: 'unstable',
    governancePosture: 'decision_blocked',
    priorityDistribution: {
      criticalMissionCount: 3,
      highMissionCount: 0,
      normalMissionCount: 0,
      lowMissionCount: 0,
      deferredMissionCount: 0,
      posture: 'critical_overload',
    },
    blockingClusters: [{
      portfolioBlockingClusterId: 'cluster-1',
      missionPortfolioId: 'portfolio-1',
      blockingMissionRunIds: ['run-x'],
      blockedMissionRunIds: ['run-1'],
      reasonTokens: ['blocked'],
      severity: 'critical',
      state: 'active',
    }],
    linkedEscalationSummaries: [],
    linkedDecisionSummaries: [{
      missionRunId: 'run-1',
      decisionRecordId: 'd-1',
      decisionOutcome: 'rejected',
      governanceStatus: 'rejected',
    }],
    statusPreview: {},
    reportPreview: {},
    ...overrides,
  };
}

describe('mission portfolio escalation', () => {
  it('T-MPA-E1 derives blocked, unstable, governance, and critical overload escalations', () => {
    const source = portfolio();
    const requirements = deriveMissionPortfolioAttentionRequirements({
      portfolio: source,
      forceAttentionRequested: false,
    });

    const escalations = deriveMissionPortfolioEscalations({
      portfolio: source,
      requirements,
    });

    expect(escalations.map((entry) => entry.escalationClass)).toContain('portfolio_blocked');
    expect(escalations.map((entry) => entry.escalationClass)).toContain('portfolio_unstable');
    expect(escalations.map((entry) => entry.escalationClass)).toContain('portfolio_governance_blocked');
    expect(escalations.map((entry) => entry.escalationClass)).toContain('portfolio_critical_overload');
  });

  it('T-MPA-E2 derives priority conflict and severity remains deterministic', () => {
    const source = portfolio({
      readinessState: 'ready',
      healthState: 'healthy',
      governancePosture: 'clear',
      priorityDistribution: {
        criticalMissionCount: 1,
        highMissionCount: 3,
        normalMissionCount: 0,
        lowMissionCount: 0,
        deferredMissionCount: 0,
        posture: 'priority_skewed',
      },
      blockingClusters: [],
      linkedDecisionSummaries: [],
    });

    const requirements = deriveMissionPortfolioAttentionRequirements({
      portfolio: source,
      forceAttentionRequested: false,
    });

    const first = deriveMissionPortfolioEscalations({ portfolio: source, requirements });
    const second = deriveMissionPortfolioEscalations({ portfolio: source, requirements });

    expect(first).toEqual(second);
    expect(first.map((entry) => entry.escalationClass)).toContain('portfolio_priority_conflict');
  });
});
