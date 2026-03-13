import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionExecutionCoordinationManager } from '../../mission-control/mission-execution-coordination-manager.ts';
import { createMissionExecutionCoordinationProjection } from '../../mission-control/mission-execution-coordination-projection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-execution-coordination-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission execution coordination integration', () => {
  it('T-MEC-I1 full mission-control orchestration to execution coordination bridge remains deterministic and additive', () => {
    const projection = createMissionExecutionCoordinationProjection({
      orchestrationProjection: {
        projectAll: () => [{
          missionControlInterventionPlanId: 'plan-1',
          crossPortfolioMissionIntelligenceSetId: 'set-1',
          displayName: 'Set 1',
          interventionPlan: {
            missionControlInterventionPlanId: 'plan-1',
            crossPortfolioMissionIntelligenceSetId: 'set-1',
            displayName: 'Set 1 Orchestration Plan',
            strategyClass: 'dependency_relief_strategy',
            portfolioIds: ['portfolio-a', 'portfolio-b'],
            systemicBlockingClusterIds: ['cluster-1'],
            escalationPatternIds: ['pattern-1'],
            actionItemIds: ['action-1', 'action-2'],
            priority: 'high',
            outcome: 'active',
            state: 'active',
          },
          stabilizationStrategy: {
            systemicStabilizationStrategyId: 'strategy-1',
            missionControlInterventionPlanId: 'plan-1',
            strategyClass: 'dependency_relief_strategy',
            reasonTokens: [],
            linkedDependencyIds: [],
            linkedBlockingClusterIds: [],
            linkedEscalationPatternIds: [],
            state: 'active',
          },
          actionItems: [
            {
              missionControlOrchestrationActionItemId: 'action-1',
              missionControlInterventionPlanId: 'plan-1',
              actionClass: 'maintain_watch_state',
              priority: 'high',
              reasonTokens: ['seed:a'],
              linkedPortfolioIds: ['portfolio-a'],
              linkedRequirementIds: [],
              linkedEscalationPatternIds: [],
              state: 'active',
            },
            {
              missionControlOrchestrationActionItemId: 'action-2',
              missionControlInterventionPlanId: 'plan-1',
              actionClass: 'request_resolution_reassessment',
              priority: 'high',
              reasonTokens: ['seed:b'],
              linkedPortfolioIds: ['portfolio-b'],
              linkedRequirementIds: [],
              linkedEscalationPatternIds: [],
              state: 'pending',
            },
          ],
          orchestrationQueue: null,
          priorityPosture: {
            missionControlInterventionPlanId: 'plan-1',
            priority: 'high',
            systemicRiskPosture: 'unstable',
            readinessPosture: 'blocked',
            highestBlockingSeverity: 'high',
            highestEscalationSeverity: 'high',
            reasonTokens: [],
          },
          orchestrationOutcome: {
            missionControlInterventionPlanId: 'plan-1',
            outcome: 'active',
            reasonTokens: [],
          },
          orchestrationHistory: { missionControlInterventionPlanId: 'plan-1', entries: [] },
          orchestrationHistorySummary: { totalEvents: 0, lastEventType: null },
          interventionPlanPosture: { state: 'active', priority: 'high', outcome: 'active' },
          stabilizationStrategySummary: { strategyClass: 'dependency_relief_strategy', state: 'active', reasonTokens: [] },
          actionItemStates: [],
          queueStateSummary: { queueState: null, state: 'active' },
          statusPreview: {},
          reportPreview: {},
        }],
        projectOne: () => ({}) as never,
        listInterventionPlans: () => [],
        inspectOrchestrationQueue: () => [],
      } as never,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const plan = projection.listExecutionCoordinationPlans()[0];
    expect(plan).toBeDefined();

    const manager = createMissionExecutionCoordinationManager({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = manager.materializeExecutionCoordinationPlan({
      missionExecutionCoordinationPlanId: plan!.missionExecutionCoordinationPlanId,
    });

    const second = manager.materializeExecutionCoordinationPlan({
      missionExecutionCoordinationPlanId: plan!.missionExecutionCoordinationPlanId,
    });

    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.readFileSync(first.historyPath, 'utf8')).toBe(fs.readFileSync(second.historyPath, 'utf8'));

    const projected = projection.projectOne({ missionExecutionCoordinationPlanId: plan!.missionExecutionCoordinationPlanId });
    expect(projected.linkedActionItemIds).toEqual(['action-1', 'action-2']);
    expect(projected.plan.missionControlInterventionPlanId).toBe('plan-1');
  });
});
