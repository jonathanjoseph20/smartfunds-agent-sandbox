import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMissionControlOrchestrationHistoryStore } from '../../mission-control/mission-control-orchestration-history-store.ts';
import { createMissionControlOrchestrationProjection } from '../../mission-control/mission-control-orchestration-projection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-control-orchestration-queue');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission control orchestration queue', () => {
  it('T-MCO-Q1 deterministic ordering and queue dedupe are stable', () => {
    const projection = createMissionControlOrchestrationProjection({
      crossPortfolioProjection: {
        projectAll: () => [
          {
            crossPortfolioMissionIntelligenceSetId: 'set-a',
            displayName: 'Set A',
            setType: 'systemic_blocking_set',
            portfolioIds: ['portfolio-a'],
            membershipSummary: { totalPortfolioCount: 1, uniquePortfolioCount: 1 },
            sharedDependencies: [],
            systemicBlockingClusters: [{ systemicBlockingClusterId: 'cluster-a', severity: 'critical' }],
            escalationPatterns: [],
            systemicRiskPosture: 'critical',
            readinessPosture: 'blocked',
            intelligenceOutcome: 'attention_required',
            linkedPortfolioSummaries: [],
            statusPreview: {},
            reportPreview: {},
          },
          {
            crossPortfolioMissionIntelligenceSetId: 'set-b',
            displayName: 'Set B',
            setType: 'systemic_blocking_set',
            portfolioIds: ['portfolio-b'],
            membershipSummary: { totalPortfolioCount: 1, uniquePortfolioCount: 1 },
            sharedDependencies: [],
            systemicBlockingClusters: [{ systemicBlockingClusterId: 'cluster-b', severity: 'low' }],
            escalationPatterns: [],
            systemicRiskPosture: 'degraded',
            readinessPosture: 'partially_ready',
            intelligenceOutcome: 'watch',
            linkedPortfolioSummaries: [],
            statusPreview: {},
            reportPreview: {},
          },
        ],
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
    });

    const queue = projection.inspectOrchestrationQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0]?.priority).toBe('critical');

    const historyStore = createMissionControlOrchestrationHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const first = historyStore.appendEvent({
      missionControlInterventionPlanId: 'plan-1',
      eventType: 'mission_control_orchestration_queued',
      reasonTokens: ['a'],
      payload: { x: 1 },
    });

    const second = historyStore.appendEvent({
      missionControlInterventionPlanId: 'plan-1',
      eventType: 'mission_control_orchestration_queued',
      reasonTokens: ['a'],
      payload: { x: 1 },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
  });
});
