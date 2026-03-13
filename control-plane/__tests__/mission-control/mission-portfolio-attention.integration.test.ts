import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionPortfolioAttentionInspection } from '../../mission-control/mission-portfolio-attention-inspection.ts';
import { createMissionPortfolioAttentionManager } from '../../mission-control/mission-portfolio-attention-manager.ts';
import { createMissionPortfolioAttentionMaterializer } from '../../mission-control/mission-portfolio-attention-materializer.ts';
import { createMissionPortfolioAttentionProjection } from '../../mission-control/mission-portfolio-attention-projection.ts';
import type { MissionPortfolioProjection } from '../../mission-control/mission-portfolio-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-portfolio-attention-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function portfolioProjection(): MissionPortfolioProjection {
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
    governancePosture: 'mixed',
    priorityDistribution: {
      criticalMissionCount: 1,
      highMissionCount: 1,
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
      escalationId: 'mission-esc-1',
      escalationClass: 'terminal_node_failure',
      severity: 'high',
      state: 'open',
    }],
    linkedDecisionSummaries: [{
      missionRunId: 'run-2',
      decisionRecordId: 'decision-1',
      decisionOutcome: 'rejected',
      governanceStatus: 'rejected',
    }],
    statusPreview: { missionPortfolioId: 'portfolio-1' },
    reportPreview: { missionPortfolioId: 'portfolio-1' },
  };
}

describe('mission portfolio attention integration', () => {
  it('T-MPA-I1 deterministic replay/materialization and no upstream mutation', () => {
    const upstreamSnapshot = portfolioProjection();

    const projection = createMissionPortfolioAttentionProjection({
      missionPortfolioProjection: {
        summarizeList: () => [{ missionPortfolioId: 'portfolio-1' }],
        projectOne: () => portfolioProjection(),
        projectAll: () => [portfolioProjection()],
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const inspection = createMissionPortfolioAttentionInspection({ projection });
    const manager = createMissionPortfolioAttentionManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });
    const materializer = createMissionPortfolioAttentionMaterializer({
      inspection,
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const queueFirst = inspection.listPortfolioAttentionQueue();
    const queueSecond = inspection.listPortfolioAttentionQueue();
    expect(queueSecond).toEqual(queueFirst);

    const initialQueueId = queueFirst[0]?.portfolioAttentionQueueEntryId;
    manager.acknowledgePortfolio({ missionPortfolioId: 'portfolio-1', requestedBy: 'operator' });
    manager.escalatePortfolio({ missionPortfolioId: 'portfolio-1', requestedBy: 'operator' });

    const replayFirst = inspection.inspectPortfolioActionHistory({ missionPortfolioId: 'portfolio-1' });
    const replaySecond = inspection.inspectPortfolioActionHistory({ missionPortfolioId: 'portfolio-1' });
    expect(replaySecond).toEqual(replayFirst);

    const first = materializer.materializeOne({ missionPortfolioId: 'portfolio-1' });
    const second = materializer.materializeOne({ missionPortfolioId: 'portfolio-1' });

    const firstSnapshot = {
      status: fs.readFileSync(first.statusPath, 'utf8'),
      queue: fs.readFileSync(first.queuePath, 'utf8'),
      escalations: fs.readFileSync(first.escalationsPath, 'utf8'),
      requirements: fs.readFileSync(first.requirementsPath, 'utf8'),
      history: fs.readFileSync(first.actionHistoryPath, 'utf8'),
      outcome: fs.readFileSync(first.actionOutcomePath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.reportMarkdownPath, 'utf8'),
      attentionHistory: fs.readFileSync(first.historyPath, 'utf8'),
    };

    const secondSnapshot = {
      status: fs.readFileSync(second.statusPath, 'utf8'),
      queue: fs.readFileSync(second.queuePath, 'utf8'),
      escalations: fs.readFileSync(second.escalationsPath, 'utf8'),
      requirements: fs.readFileSync(second.requirementsPath, 'utf8'),
      history: fs.readFileSync(second.actionHistoryPath, 'utf8'),
      outcome: fs.readFileSync(second.actionOutcomePath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.reportMarkdownPath, 'utf8'),
      attentionHistory: fs.readFileSync(second.historyPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);

    const finalProjection = projection.projectOne({ missionPortfolioId: 'portfolio-1' });
    expect(finalProjection.portfolioAttentionQueueEntryId).toBe(initialQueueId);

    expect(portfolioProjection()).toEqual(upstreamSnapshot);
  });
});
