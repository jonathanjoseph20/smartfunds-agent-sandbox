import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionControlOrchestrationManager } from '../../mission-control/mission-control-orchestration-manager.ts';
import { createMissionControlOrchestrationProjection } from '../../mission-control/mission-control-orchestration-projection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-control-orchestration-actions');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function buildProjection() {
  return createMissionControlOrchestrationProjection({
    crossPortfolioProjection: {
      projectAll: () => [{
        crossPortfolioMissionIntelligenceSetId: 'set-1',
        displayName: 'Set 1',
        setType: 'systemic_blocking_set',
        portfolioIds: ['portfolio-a'],
        membershipSummary: { totalPortfolioCount: 1, uniquePortfolioCount: 1 },
        sharedDependencies: [],
        systemicBlockingClusters: [{ systemicBlockingClusterId: 'cluster-1', severity: 'high' }],
        escalationPatterns: [],
        systemicRiskPosture: 'unstable',
        readinessPosture: 'blocked',
        intelligenceOutcome: 'attention_required',
        linkedPortfolioSummaries: [],
        statusPreview: {},
        reportPreview: {},
      }],
      projectOne: () => ({}) as never,
      listIntelligenceSets: () => [],
    } as never,
    attentionProjection: {
      projectOne: () => ({ attentionRequirements: [], escalations: [] }),
    } as never,
    resolutionProjection: {
      projectOne: () => ({ resolution: { linkedRequirementIds: [] } }),
    } as never,
    governanceProjection: {
      summarizeQueue: () => [],
    } as never,
    missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
  });
}

describe('mission control orchestration actions', () => {
  it('T-MCO-A1 creation ordering and state transitions remain deterministic', () => {
    const projection = buildProjection();
    const plan = projection.listInterventionPlans()[0];
    expect(plan).toBeDefined();

    const manager = createMissionControlOrchestrationManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const deferred = manager.deferInterventionPlan({
      missionControlInterventionPlanId: plan!.missionControlInterventionPlanId,
    });

    expect(deferred.actionItems.every((entry) => entry.state === 'deferred' || entry.state === 'completed')).toBe(true);

    const completed = manager.markInterventionPlanComplete({
      missionControlInterventionPlanId: plan!.missionControlInterventionPlanId,
    });

    expect(completed.actionItems.every((entry) => entry.state === 'completed')).toBe(true);
    expect(completed.actionItems.map((entry) => entry.missionControlOrchestrationActionItemId)).toEqual(
      [...completed.actionItems.map((entry) => entry.missionControlOrchestrationActionItemId)].sort((left, right) => left.localeCompare(right))
    );
  });
});
