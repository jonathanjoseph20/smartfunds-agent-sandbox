import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionPortfolioInspection } from '../../mission-control/mission-portfolio-inspection.ts';
import { createMissionPortfolioMaterializer } from '../../mission-control/mission-portfolio-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-portfolio-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission portfolio integration', () => {
  it('T-MP-I1 end-to-end projection and materialization are deterministic', () => {
    const projection = {
      summarizeList: () => [{ missionPortfolioId: 'p-1' }],
      projectOne: () => ({
        missionPortfolioId: 'p-1',
        displayName: 'P1',
        portfolioType: 'coordination_portfolio',
        missionRunIds: ['run-1'],
        memberships: [{
          missionPortfolioMembershipId: 'm-1',
          missionPortfolioId: 'p-1',
          missionRunId: 'run-1',
          membershipClass: 'shared_priority_band',
          reasonTokens: ['priority:critical'],
          state: 'active',
        }],
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
        readinessState: 'partially_ready',
        healthState: 'degraded',
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
          portfolioBlockingClusterId: 'c-1',
          missionPortfolioId: 'p-1',
          blockingMissionRunIds: ['run-x'],
          blockedMissionRunIds: ['run-1'],
          reasonTokens: ['upstream'],
          severity: 'high',
          state: 'active',
        }],
        linkedEscalationSummaries: [],
        linkedDecisionSummaries: [],
        statusPreview: { missionPortfolioId: 'p-1' },
        reportPreview: { missionPortfolioId: 'p-1', blockingClusters: ['c-1'] },
      }),
      projectAll: () => [],
    } as never;

    const inspection = createMissionPortfolioInspection({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const before = inspection.inspectMissionPortfolio({ missionPortfolioId: 'p-1' });
    const replay1 = inspection.evaluateMissionPortfolio({ missionPortfolioId: 'p-1' });
    const replay2 = inspection.evaluateMissionPortfolio({ missionPortfolioId: 'p-1' });

    expect(replay2).toEqual(replay1);

    const materializer = createMissionPortfolioMaterializer({
      inspection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = materializer.materializeOne({ missionPortfolioId: 'p-1' });
    const second = materializer.materializeOne({ missionPortfolioId: 'p-1' });

    const firstSnapshot = {
      status: fs.readFileSync(first.statusPath, 'utf8'),
      readiness: fs.readFileSync(first.readinessPath, 'utf8'),
      health: fs.readFileSync(first.healthPath, 'utf8'),
      governance: fs.readFileSync(first.governancePath, 'utf8'),
      membership: fs.readFileSync(first.membershipPath, 'utf8'),
      blocking: fs.readFileSync(first.blockingPath, 'utf8'),
      history: fs.readFileSync(first.historyPath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.reportMarkdownPath, 'utf8'),
    };

    const secondSnapshot = {
      status: fs.readFileSync(second.statusPath, 'utf8'),
      readiness: fs.readFileSync(second.readinessPath, 'utf8'),
      health: fs.readFileSync(second.healthPath, 'utf8'),
      governance: fs.readFileSync(second.governancePath, 'utf8'),
      membership: fs.readFileSync(second.membershipPath, 'utf8'),
      blocking: fs.readFileSync(second.blockingPath, 'utf8'),
      history: fs.readFileSync(second.historyPath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.reportMarkdownPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
    expect(inspection.inspectMissionPortfolio({ missionPortfolioId: 'p-1' })).toEqual(before);
  });
});
