import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCrossPortfolioMissionIntelligenceManager } from '../../mission-control/cross-portfolio-intelligence-manager.ts';
import { createCrossPortfolioMissionIntelligenceProjection } from '../../mission-control/cross-portfolio-intelligence-projection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-cross-portfolio-intelligence-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('cross-portfolio mission intelligence integration', () => {
  it('T-CPMI-I1 deterministic pipeline and no mutation of upstream portfolio state', () => {
    const coordinationRecords = {
      'portfolio-a': {
        missionPortfolioId: 'portfolio-a',
        displayName: 'Portfolio A',
        portfolioType: 'objective_portfolio',
        missionRunIds: ['run-a'],
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
          missionPortfolioId: 'portfolio-a',
          blockingMissionRunIds: ['run-a'],
          blockedMissionRunIds: ['run-a'],
          reasonTokens: ['dependency:upstream_cluster'],
          severity: 'high',
          state: 'active',
        }],
        linkedEscalationSummaries: [],
        linkedDecisionSummaries: [],
        statusPreview: {},
        reportPreview: {},
      },
      'portfolio-b': {
        missionPortfolioId: 'portfolio-b',
        displayName: 'Portfolio B',
        portfolioType: 'objective_portfolio',
        missionRunIds: ['run-b'],
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
          missionPortfolioId: 'portfolio-b',
          blockingMissionRunIds: ['run-b'],
          blockedMissionRunIds: ['run-b'],
          reasonTokens: ['dependency:upstream_cluster'],
          severity: 'high',
          state: 'active',
        }],
        linkedEscalationSummaries: [],
        linkedDecisionSummaries: [],
        statusPreview: {},
        reportPreview: {},
      },
    } as const;

    const attentionRecords = {
      'portfolio-a': {
        missionPortfolioId: 'portfolio-a',
        portfolioAttentionQueueEntryId: 'aq-a',
        attentionStatus: 'awaiting_attention',
        activeRequirementClasses: ['critical_blocking_cluster'],
        escalationSummaries: [],
        actionOutcome: 'pending',
        priorityDistribution: coordinationRecords['portfolio-a'].priorityDistribution,
        linkedBlockingClusters: ['cluster-shared'],
        linkedMissionEscalations: [],
        activeActionRecordId: null,
        actionHistory: [],
        attentionRequirements: [{
          portfolioAttentionRequirementId: 'req-a',
          missionPortfolioId: 'portfolio-a',
          requirementClass: 'critical_blocking_cluster',
          severity: 'high',
          reasonTokens: ['dependency:upstream_cluster'],
          linkedBlockingClusterIds: ['cluster-shared'],
          linkedMissionRunIds: ['run-a'],
          linkedDecisionIds: [],
          state: 'active',
        }],
        escalations: [{
          portfolioEscalationId: 'esc-a',
          missionPortfolioId: 'portfolio-a',
          escalationClass: 'portfolio_blocked',
          severity: 'high',
          reasonTokens: ['dependency:upstream_cluster'],
          linkedRequirementIds: ['req-a'],
          linkedMissionRunIds: ['run-a'],
          state: 'open',
        }],
        queueEntry: null,
        actionRecords: [],
        statusPreview: {},
        reportPreview: {},
      },
      'portfolio-b': {
        missionPortfolioId: 'portfolio-b',
        portfolioAttentionQueueEntryId: 'aq-b',
        attentionStatus: 'awaiting_attention',
        activeRequirementClasses: ['critical_blocking_cluster'],
        escalationSummaries: [],
        actionOutcome: 'pending',
        priorityDistribution: coordinationRecords['portfolio-b'].priorityDistribution,
        linkedBlockingClusters: ['cluster-shared'],
        linkedMissionEscalations: [],
        activeActionRecordId: null,
        actionHistory: [],
        attentionRequirements: [{
          portfolioAttentionRequirementId: 'req-b',
          missionPortfolioId: 'portfolio-b',
          requirementClass: 'critical_blocking_cluster',
          severity: 'high',
          reasonTokens: ['dependency:upstream_cluster'],
          linkedBlockingClusterIds: ['cluster-shared'],
          linkedMissionRunIds: ['run-b'],
          linkedDecisionIds: [],
          state: 'active',
        }],
        escalations: [{
          portfolioEscalationId: 'esc-b',
          missionPortfolioId: 'portfolio-b',
          escalationClass: 'portfolio_blocked',
          severity: 'high',
          reasonTokens: ['dependency:upstream_cluster'],
          linkedRequirementIds: ['req-b'],
          linkedMissionRunIds: ['run-b'],
          state: 'open',
        }],
        queueEntry: null,
        actionRecords: [],
        statusPreview: {},
        reportPreview: {},
      },
    } as const;

    const resolutionRecords = {
      'portfolio-a': {
        missionPortfolioId: 'portfolio-a',
        portfolioResolutionQueueEntryId: 'rq-a',
        stabilizationStatus: 'regressed',
        resolutionStatus: 'unresolved',
        closureEligibility: 'blocked_from_closure',
        closureState: 'under_resolution_review',
        resolutionOutcome: 'pending',
        linkedBlockingClusters: ['cluster-shared'],
        linkedEscalations: ['esc-a'],
        activeResolutionActionRecordId: null,
        resolutionActionHistory: [],
        stabilization: { reasonTokens: ['stabilization:regressed'] },
        resolution: { reasonTokens: ['resolution:unresolved'] },
        closureEligibilityRecord: { reasonTokens: ['closure:blocking'] },
        queueEntry: null,
        actionRecords: [],
        statusPreview: {},
        reportPreview: {},
      },
      'portfolio-b': {
        missionPortfolioId: 'portfolio-b',
        portfolioResolutionQueueEntryId: 'rq-b',
        stabilizationStatus: 'regressed',
        resolutionStatus: 'unresolved',
        closureEligibility: 'blocked_from_closure',
        closureState: 'under_resolution_review',
        resolutionOutcome: 'pending',
        linkedBlockingClusters: ['cluster-shared'],
        linkedEscalations: ['esc-b'],
        activeResolutionActionRecordId: null,
        resolutionActionHistory: [],
        stabilization: { reasonTokens: ['stabilization:regressed'] },
        resolution: { reasonTokens: ['resolution:unresolved'] },
        closureEligibilityRecord: { reasonTokens: ['closure:blocking'] },
        queueEntry: null,
        actionRecords: [],
        statusPreview: {},
        reportPreview: {},
      },
    } as const;

    const upstreamSnapshot = JSON.stringify({
      coordinationRecords,
      attentionRecords,
      resolutionRecords,
    });

    const projection = createCrossPortfolioMissionIntelligenceProjection({
      coordinationProjection: {
        summarizeList: () => [{ missionPortfolioId: 'portfolio-a' }, { missionPortfolioId: 'portfolio-b' }],
        projectOne: ({ missionPortfolioId }: { missionPortfolioId: string }) => coordinationRecords[missionPortfolioId as 'portfolio-a' | 'portfolio-b'],
      } as never,
      attentionProjection: {
        projectOne: ({ missionPortfolioId }: { missionPortfolioId: string }) => attentionRecords[missionPortfolioId as 'portfolio-a' | 'portfolio-b'],
      } as never,
      resolutionProjection: {
        projectOne: ({ missionPortfolioId }: { missionPortfolioId: string }) => resolutionRecords[missionPortfolioId as 'portfolio-a' | 'portfolio-b'],
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const set = projection.listIntelligenceSets()[0];
    expect(set).toBeDefined();

    const manager = createCrossPortfolioMissionIntelligenceManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = manager.materializeIntelligenceSet({
      crossPortfolioMissionIntelligenceSetId: set!.crossPortfolioMissionIntelligenceSetId,
    });
    const second = manager.materializeIntelligenceSet({
      crossPortfolioMissionIntelligenceSetId: set!.crossPortfolioMissionIntelligenceSetId,
    });

    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.readFileSync(first.historyPath, 'utf8')).toBe(fs.readFileSync(second.historyPath, 'utf8'));
    expect(JSON.stringify({ coordinationRecords, attentionRecords, resolutionRecords })).toBe(upstreamSnapshot);
  });
});
