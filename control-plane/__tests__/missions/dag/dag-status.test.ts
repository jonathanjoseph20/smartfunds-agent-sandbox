import { describe, expect, it } from 'vitest';

import type { MissionInstance } from '../../../missions/mission-instance-types.ts';
import {
  evaluateMissionDAGStatus,
  evaluateNodeStates,
  getBlockedNodes,
  getReadyNodes,
} from '../../../missions/dag/mission-dag-status.ts';
import type { MissionDAGDefinition } from '../../../missions/dag/mission-dag-types.ts';

function buildInstance(missionId: string, overrides: Partial<MissionInstance> = {}): MissionInstance {
  return {
    missionId,
    missionType: 'evaluate-startup-opportunity',
    displayName: missionId,
    objective: 'Objective',
    founderInstructions: 'Keep deterministic',
    requestedDeliverables: [{ deliverableId: 'memo' }],
    sourceReferences: [{ sourceKind: 'memo', sourceId: 'memo-1', reference: 'memo://1' }],
    linkedActionPlanIds: [],
    linkedPortfolioIds: [],
    linkedMarketSynthesisIds: [],
    recommendedTeamIds: [],
    assignedTeamIds: [],
    approvalState: 'approved',
    lifecycleState: 'active',
    readinessState: 'ready',
    completionState: 'in_progress',
    blockingReasons: [],
    limitations: [],
    createdFrom: { kind: 'founder_directive' },
    historyDigest: '',
    ...overrides,
  };
}

function buildDefinition(): MissionDAGDefinition {
  return {
    dagId: 'dag-1',
    displayName: 'DAG',
    rootMissionId: 'mission-root',
    nodes: [
      { missionId: 'mission-root' },
      { missionId: 'mission-market' },
      { missionId: 'mission-product' },
    ],
    edges: [
      { parentMissionId: 'mission-root', childMissionId: 'mission-market' },
      { parentMissionId: 'mission-market', childMissionId: 'mission-product' },
    ],
  };
}

describe('mission DAG status', () => {
  it('T-MDAG-S1 marks completed when all missions are completed', () => {
    const definition = buildDefinition();
    const instances = definition.nodes.map((node) => buildInstance(node.missionId, {
      lifecycleState: 'completed',
      completionState: 'completed',
      readinessState: 'ready',
    }));

    const status = evaluateMissionDAGStatus({ definition, missionInstances: instances });
    expect(status.dagStatus).toBe('COMPLETED');
    expect(status.completedNodes).toEqual(['mission-market', 'mission-product', 'mission-root']);
  });

  it('T-MDAG-S2 propagates blocking through dependency chains', () => {
    const definition = buildDefinition();
    const status = evaluateMissionDAGStatus({
      definition,
      missionInstances: [
        buildInstance('mission-root', { readinessState: 'blocked', lifecycleState: 'blocked' }),
        buildInstance('mission-market', { readinessState: 'ready' }),
        buildInstance('mission-product', { readinessState: 'ready' }),
      ],
    });

    expect(status.dagStatus).toBe('BLOCKED');
    expect(status.blockedNodes).toEqual(['mission-market', 'mission-product', 'mission-root']);
  });

  it('T-MDAG-S3 returns ready nodes only when dependencies are completed', () => {
    const definition = buildDefinition();
    const nodeStates = evaluateNodeStates({
      definition,
      missionInstances: [
        buildInstance('mission-root', { completionState: 'completed', lifecycleState: 'completed' }),
        buildInstance('mission-market', { readinessState: 'ready', completionState: 'in_progress' }),
        buildInstance('mission-product', { readinessState: 'ready', completionState: 'in_progress' }),
      ],
    });

    expect(getReadyNodes({ nodeStates })).toEqual(['mission-market']);
    expect(getBlockedNodes({ nodeStates })).toEqual([]);
  });

  it('T-MDAG-S4 classifies incomplete when work remains without blocking', () => {
    const definition = buildDefinition();
    const status = evaluateMissionDAGStatus({
      definition,
      missionInstances: [
        buildInstance('mission-root', { readinessState: 'ready', completionState: 'in_progress' }),
        buildInstance('mission-market', { readinessState: 'pending', completionState: 'not_started' }),
        buildInstance('mission-product', { readinessState: 'pending', completionState: 'not_started' }),
      ],
    });

    expect(status.dagStatus).toBe('READY');
    expect(status.readyNodes).toEqual(['mission-root']);
  });

  it('T-MDAG-S5 classifies inconclusive on conflicting states', () => {
    const definition = buildDefinition();
    const status = evaluateMissionDAGStatus({
      definition,
      missionInstances: [
        buildInstance('mission-root', { readinessState: 'inconclusive', completionState: 'inconclusive' }),
        buildInstance('mission-market'),
        buildInstance('mission-product'),
      ],
    });

    expect(status.dagStatus).toBe('INCONCLUSIVE');
    expect(status.nodeStates.find((entry) => entry.missionId === 'mission-root')?.state).toBe('INCONCLUSIVE');
  });
});
