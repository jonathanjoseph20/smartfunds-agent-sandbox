import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionExecutionCoordinationMaterializer } from '../../mission-control/mission-execution-coordination-materializer.ts';
import { createMissionExecutionCoordinationProjection } from '../../mission-control/mission-execution-coordination-projection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-execution-coordination-projection');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission execution coordination projection', () => {
  it('T-MEC-PR1 replay stable projection with deterministic status/outcome and artifacts', () => {
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
            strategyClass: 'systemic_watch_strategy',
            portfolioIds: [],
            systemicBlockingClusterIds: [],
            escalationPatternIds: [],
            actionItemIds: ['action-1'],
            priority: 'high',
            outcome: 'active',
            state: 'active',
          },
          stabilizationStrategy: {
            systemicStabilizationStrategyId: 'strategy-1',
            missionControlInterventionPlanId: 'plan-1',
            strategyClass: 'systemic_watch_strategy',
            reasonTokens: [],
            linkedDependencyIds: [],
            linkedBlockingClusterIds: [],
            linkedEscalationPatternIds: [],
            state: 'active',
          },
          actionItems: [{
            missionControlOrchestrationActionItemId: 'action-1',
            missionControlInterventionPlanId: 'plan-1',
            actionClass: 'maintain_watch_state',
            priority: 'high',
            reasonTokens: [],
            linkedPortfolioIds: [],
            linkedRequirementIds: [],
            linkedEscalationPatternIds: [],
            state: 'active',
          }],
          orchestrationQueue: null,
          priorityPosture: {
            missionControlInterventionPlanId: 'plan-1',
            priority: 'high',
            systemicRiskPosture: 'degraded',
            readinessPosture: 'partially_ready',
            highestBlockingSeverity: 'none',
            highestEscalationSeverity: 'none',
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
          stabilizationStrategySummary: { strategyClass: 'systemic_watch_strategy', state: 'active', reasonTokens: [] },
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

    const one = projection.projectAll();
    const two = projection.projectAll();

    expect(two).toEqual(one);
    expect(two[0]!.status.status).toBe('execution_active');
    expect(two[0]!.outcome.outcome).toBe('active');

    const materializer = createMissionExecutionCoordinationMaterializer({
      projection,
      missionControlArtifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = materializer.materializeOne({ missionExecutionCoordinationPlanId: one[0]!.missionExecutionCoordinationPlanId });
    const second = materializer.materializeOne({ missionExecutionCoordinationPlanId: one[0]!.missionExecutionCoordinationPlanId });

    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.readFileSync(first.reportPath, 'utf8')).toBe(fs.readFileSync(second.reportPath, 'utf8'));
  });
});
