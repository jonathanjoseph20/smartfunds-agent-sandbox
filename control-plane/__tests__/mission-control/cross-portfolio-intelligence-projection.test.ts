import { describe, expect, it } from 'vitest';

import { createCrossPortfolioMissionIntelligenceProjection } from '../../mission-control/cross-portfolio-intelligence-projection.ts';

function coordination(missionPortfolioId: string, displayName: string) {
  return {
    missionPortfolioId,
    displayName,
    portfolioType: 'objective_portfolio',
    missionRunIds: ['run-1'],
    memberships: [],
    membershipSummaries: {
      totalMembershipCount: 1,
      activeMembershipCount: 1,
      membershipClassCounts: {
        shared_objective: 1,
        shared_dependency_chain: 0,
        shared_governance_track: 0,
        shared_priority_band: 0,
        explicit_portfolio_membership: 0,
        shared_operating_domain: 0,
      },
    },
    readinessState: 'blocked',
    healthState: 'degraded',
    governancePosture: 'decision_blocked',
    priorityDistribution: {
      criticalMissionCount: 1,
      highMissionCount: 0,
      normalMissionCount: 0,
      lowMissionCount: 0,
      deferredMissionCount: 0,
      posture: 'critical_overload',
    },
    blockingClusters: [{
      portfolioBlockingClusterId: 'cluster-shared',
      missionPortfolioId,
      blockingMissionRunIds: ['run-1'],
      blockedMissionRunIds: ['run-1'],
      reasonTokens: ['dependency:upstream_cluster'],
      severity: 'high',
      state: 'active',
    }],
    linkedEscalationSummaries: [],
    linkedDecisionSummaries: [],
    statusPreview: {},
    reportPreview: {},
  };
}

function attention(missionPortfolioId: string) {
  return {
    missionPortfolioId,
    portfolioAttentionQueueEntryId: 'aq-1',
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
    linkedBlockingClusters: ['cluster-shared'],
    linkedMissionEscalations: [],
    activeActionRecordId: null,
    actionHistory: [],
    attentionRequirements: [{
      portfolioAttentionRequirementId: `req-${missionPortfolioId}`,
      missionPortfolioId,
      requirementClass: 'critical_blocking_cluster',
      severity: 'high',
      reasonTokens: ['dependency:upstream_cluster'],
      linkedBlockingClusterIds: ['cluster-shared'],
      linkedMissionRunIds: ['run-1'],
      linkedDecisionIds: [],
      state: 'active',
    }],
    escalations: [{
      portfolioEscalationId: `esc-${missionPortfolioId}`,
      missionPortfolioId,
      escalationClass: 'portfolio_blocked',
      severity: 'high',
      reasonTokens: ['dependency:upstream_cluster'],
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

function resolution(missionPortfolioId: string) {
  return {
    missionPortfolioId,
    portfolioResolutionQueueEntryId: 'rq-1',
    stabilizationStatus: 'regressed',
    resolutionStatus: 'unresolved',
    closureEligibility: 'blocked_from_closure',
    closureState: 'under_resolution_review',
    resolutionOutcome: 'pending',
    linkedBlockingClusters: ['cluster-shared'],
    linkedEscalations: [`esc-${missionPortfolioId}`],
    activeResolutionActionRecordId: null,
    resolutionActionHistory: [],
    stabilization: { reasonTokens: ['dependency:upstream_cluster'] },
    resolution: { reasonTokens: ['resolution:unresolved'] },
    closureEligibilityRecord: { reasonTokens: ['closure:blocked'] },
    queueEntry: null,
    actionRecords: [],
    statusPreview: {},
    reportPreview: {},
  };
}

describe('cross-portfolio intelligence projection', () => {
  it('T-CPMI-P1 deterministic replay keeps sharedDependencies/blocking/risk/readiness stable', () => {
    const projection = createCrossPortfolioMissionIntelligenceProjection({
      coordinationProjection: {
        summarizeList: () => [
          { missionPortfolioId: 'portfolio-a' },
          { missionPortfolioId: 'portfolio-b' },
        ],
        projectOne: ({ missionPortfolioId }: { missionPortfolioId: string }) => coordination(
          missionPortfolioId,
          missionPortfolioId === 'portfolio-a' ? 'Portfolio A' : 'Portfolio B'
        ),
      } as never,
      attentionProjection: {
        projectOne: ({ missionPortfolioId }: { missionPortfolioId: string }) => attention(missionPortfolioId),
      } as never,
      resolutionProjection: {
        projectOne: ({ missionPortfolioId }: { missionPortfolioId: string }) => resolution(missionPortfolioId),
      } as never,
    });

    const one = projection.projectAll();
    const two = projection.projectAll();

    expect(two).toEqual(one);
    expect(two[0]?.sharedDependencies).toEqual(one[0]?.sharedDependencies);
    expect(two[0]?.systemicBlockingClusters).toEqual(one[0]?.systemicBlockingClusters);
    expect(two[0]?.systemicRiskPosture).toEqual(one[0]?.systemicRiskPosture);
    expect(two[0]?.readinessPosture).toEqual(one[0]?.readinessPosture);
  });
});
