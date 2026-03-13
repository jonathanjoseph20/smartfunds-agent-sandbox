import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionControlOrchestrationManager } from '../../mission-control/mission-control-orchestration-manager.ts';
import { createMissionControlOrchestrationProjection } from '../../mission-control/mission-control-orchestration-projection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-control-orchestration-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission control orchestration integration', () => {
  it('T-MCO-I1 deterministic orchestration pipeline remains replay-stable', () => {
    const upstream = {
      portfolioIds: ['portfolio-a', 'portfolio-b'],
      requirementIds: ['req-a', 'req-b'],
    };

    const projection = createMissionControlOrchestrationProjection({
      crossPortfolioProjection: {
        projectAll: () => [{
          crossPortfolioMissionIntelligenceSetId: 'set-1',
          displayName: 'Set 1',
          setType: 'systemic_blocking_set',
          portfolioIds: [...upstream.portfolioIds],
          membershipSummary: { totalPortfolioCount: 2, uniquePortfolioCount: 2 },
          sharedDependencies: [{ crossPortfolioSharedDependencyId: 'dep-1' }],
          systemicBlockingClusters: [{ systemicBlockingClusterId: 'cluster-1', severity: 'high' }],
          escalationPatterns: [{ crossPortfolioEscalationPatternId: 'pattern-1', severity: 'high', patternClass: 'repeated_blocking_escalation' }],
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
        projectOne: ({ missionPortfolioId }: { missionPortfolioId: string }) => ({
          attentionRequirements: [{ portfolioAttentionRequirementId: missionPortfolioId === 'portfolio-a' ? 'req-a' : 'req-b' }],
          escalations: [],
        }),
      } as never,
      resolutionProjection: {
        projectOne: () => ({ resolution: { linkedRequirementIds: [] } }),
      } as never,
      governanceProjection: {
        summarizeQueue: () => [],
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const plan = projection.listInterventionPlans()[0];
    expect(plan).toBeDefined();

    const manager = createMissionControlOrchestrationManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = manager.materializeInterventionPlan({
      missionControlInterventionPlanId: plan!.missionControlInterventionPlanId,
    });

    const second = manager.materializeInterventionPlan({
      missionControlInterventionPlanId: plan!.missionControlInterventionPlanId,
    });

    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.readFileSync(first.historyPath, 'utf8')).toBe(fs.readFileSync(second.historyPath, 'utf8'));
    expect(upstream.portfolioIds).toEqual(['portfolio-a', 'portfolio-b']);
    expect(upstream.requirementIds).toEqual(['req-a', 'req-b']);
  });
});
