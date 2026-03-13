import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionPortfolioResolutionInspection } from '../../mission-control/mission-portfolio-resolution-inspection.ts';
import { createMissionPortfolioResolutionManager } from '../../mission-control/mission-portfolio-resolution-manager.ts';
import { createMissionPortfolioResolutionMaterializer } from '../../mission-control/mission-portfolio-resolution-materializer.ts';
import { createMissionPortfolioResolutionProjection } from '../../mission-control/mission-portfolio-resolution-projection.ts';
import type { MissionPortfolioAttentionProjection } from '../../mission-control/mission-portfolio-attention-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-portfolio-resolution-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function attentionProjection(): MissionPortfolioAttentionProjection {
  return {
    missionPortfolioId: 'portfolio-1',
    portfolioAttentionQueueEntryId: 'aq-1',
    attentionStatus: 'awaiting_attention',
    activeRequirementClasses: ['critical_blocking_cluster'],
    escalationSummaries: [{
      portfolioEscalationId: 'esc-1',
      escalationClass: 'portfolio_blocked',
      severity: 'critical',
      state: 'open',
    }],
    actionOutcome: 'pending',
    priorityDistribution: {
      criticalMissionCount: 1,
      highMissionCount: 1,
      normalMissionCount: 0,
      lowMissionCount: 0,
      deferredMissionCount: 0,
      posture: 'critical_overload',
    },
    linkedBlockingClusters: ['cluster-1'],
    linkedMissionEscalations: [{
      missionRunId: 'run-1',
      escalationId: 'mission-esc-1',
      escalationClass: 'terminal_node_failure',
      severity: 'high',
      state: 'open',
    }],
    activeActionRecordId: null,
    actionHistory: [],
    attentionRequirements: [{
      portfolioAttentionRequirementId: 'req-1',
      missionPortfolioId: 'portfolio-1',
      requirementClass: 'critical_blocking_cluster',
      severity: 'critical',
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
      severity: 'critical',
      reasonTokens: ['blocking'],
      linkedRequirementIds: ['req-1'],
      linkedMissionRunIds: ['run-1'],
      state: 'open',
    }],
    queueEntry: null,
    actionRecords: [],
    statusPreview: { missionPortfolioId: 'portfolio-1' },
    reportPreview: { missionPortfolioId: 'portfolio-1' },
  };
}

describe('mission portfolio resolution integration', () => {
  it('T-MPR-I1 deterministic replay/materialization and closure transitions without upstream mutation', () => {
    const upstreamSnapshot = attentionProjection();

    const projection = createMissionPortfolioResolutionProjection({
      attentionProjection: {
        projectOne: () => attentionProjection(),
        projectAll: () => [attentionProjection()],
        listAttentionQueue: () => [],
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const inspection = createMissionPortfolioResolutionInspection({ projection });
    const manager = createMissionPortfolioResolutionManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });
    const materializer = createMissionPortfolioResolutionMaterializer({
      inspection,
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const queueFirst = inspection.listResolutionQueue();
    const queueSecond = inspection.listResolutionQueue();
    expect(queueSecond).toEqual(queueFirst);

    const initialQueueId = queueFirst[0]?.portfolioResolutionQueueEntryId;

    manager.requestPortfolioResolutionReview({ missionPortfolioId: 'portfolio-1', requestedBy: 'operator' });
    manager.markPortfolioStable({ missionPortfolioId: 'portfolio-1', requestedBy: 'operator' });
    manager.markPortfolioResolved({ missionPortfolioId: 'portfolio-1', requestedBy: 'operator' });
    manager.deferPortfolioClosure({ missionPortfolioId: 'portfolio-1', requestedBy: 'operator' });
    manager.closePortfolio({ missionPortfolioId: 'portfolio-1', requestedBy: 'operator' });
    const reopened = manager.reopenPortfolio({ missionPortfolioId: 'portfolio-1', requestedBy: 'operator' });
    expect(reopened.closureState).toBe('reopened');

    const replayFirst = inspection.inspectResolutionActionHistory({ missionPortfolioId: 'portfolio-1' });
    const replaySecond = inspection.inspectResolutionActionHistory({ missionPortfolioId: 'portfolio-1' });
    expect(replaySecond).toEqual(replayFirst);

    const first = materializer.materializeOne({ missionPortfolioId: 'portfolio-1' });
    const second = materializer.materializeOne({ missionPortfolioId: 'portfolio-1' });

    const firstSnapshot = {
      stabilization: fs.readFileSync(first.stabilizationPath, 'utf8'),
      status: fs.readFileSync(first.resolutionStatusPath, 'utf8'),
      eligibility: fs.readFileSync(first.closureEligibilityPath, 'utf8'),
      queue: fs.readFileSync(first.resolutionQueuePath, 'utf8'),
      history: fs.readFileSync(first.resolutionActionHistoryPath, 'utf8'),
      closure: fs.readFileSync(first.closureStatePath, 'utf8'),
      outcome: fs.readFileSync(first.resolutionOutcomePath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.reportMarkdownPath, 'utf8'),
      persistedHistory: fs.readFileSync(first.historyPath, 'utf8'),
    };

    const secondSnapshot = {
      stabilization: fs.readFileSync(second.stabilizationPath, 'utf8'),
      status: fs.readFileSync(second.resolutionStatusPath, 'utf8'),
      eligibility: fs.readFileSync(second.closureEligibilityPath, 'utf8'),
      queue: fs.readFileSync(second.resolutionQueuePath, 'utf8'),
      history: fs.readFileSync(second.resolutionActionHistoryPath, 'utf8'),
      closure: fs.readFileSync(second.closureStatePath, 'utf8'),
      outcome: fs.readFileSync(second.resolutionOutcomePath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.reportMarkdownPath, 'utf8'),
      persistedHistory: fs.readFileSync(second.historyPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);

    const finalProjection = projection.projectOne({ missionPortfolioId: 'portfolio-1' });
    const finalProjectionReplay = projection.projectOne({ missionPortfolioId: 'portfolio-1' });
    expect(finalProjection.portfolioResolutionQueueEntryId).not.toBeNull();
    expect(finalProjection.portfolioResolutionQueueEntryId).toBe(finalProjectionReplay.portfolioResolutionQueueEntryId);
    expect(finalProjection.closureState).toBe('reopened');
    expect(initialQueueId).not.toBeNull();

    expect(attentionProjection()).toEqual(upstreamSnapshot);
  });
});
