import { describe, expect, it } from 'vitest';

import { validateMissionDAGDefinition } from '../../../missions/dag/mission-dag-validator.ts';

function validDefinition() {
  return {
    displayName: 'Evaluate Startup Opportunity DAG',
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
    tags: ['alpha', 'dag'],
  };
}

describe('mission DAG validator', () => {
  it('T-MDAG-V1 validates deterministic DAG definitions', () => {
    const validated = validateMissionDAGDefinition({
      value: validDefinition(),
      knownMissionIds: ['mission-root', 'mission-market', 'mission-product'],
    });

    expect(validated.rootMissionId).toBe('mission-root');
    expect(validated.nodes.map((entry) => entry.missionId)).toEqual(['mission-market', 'mission-product', 'mission-root']);
    expect(validated.edges).toEqual([
      { parentMissionId: 'mission-market', childMissionId: 'mission-product' },
      { parentMissionId: 'mission-root', childMissionId: 'mission-market' },
    ]);
  });

  it('T-MDAG-V2 rejects duplicate mission nodes', () => {
    const definition = validDefinition();
    definition.nodes = [...definition.nodes, { missionId: 'mission-root' }];

    expect(() => validateMissionDAGDefinition({
      value: definition,
      knownMissionIds: ['mission-root', 'mission-market', 'mission-product'],
    })).toThrow(/nodes must be unique/);
  });

  it('T-MDAG-V3 rejects duplicate edges', () => {
    const definition = validDefinition();
    definition.edges = [...definition.edges, { parentMissionId: 'mission-root', childMissionId: 'mission-market' }];

    expect(() => validateMissionDAGDefinition({
      value: definition,
      knownMissionIds: ['mission-root', 'mission-market', 'mission-product'],
    })).toThrow(/edges must be unique/);
  });

  it('T-MDAG-V4 rejects edges referencing unknown nodes', () => {
    const definition = validDefinition();
    definition.edges = [{ parentMissionId: 'mission-root', childMissionId: 'mission-unknown' }];

    expect(() => validateMissionDAGDefinition({
      value: definition,
      knownMissionIds: ['mission-root', 'mission-market', 'mission-product'],
    })).toThrow(/MISSION_DAG_INVALID_EDGE_REFERENCE/);
  });

  it('T-MDAG-V5 rejects DAGs with unknown mission nodes', () => {
    const definition = validDefinition();

    expect(() => validateMissionDAGDefinition({
      value: definition,
      knownMissionIds: ['mission-root', 'mission-market'],
    })).toThrow(/MISSION_DAG_UNKNOWN_MISSION_NODES/);
  });

  it('T-MDAG-V6 rejects invalid root mission constraints', () => {
    const missingRootNode = {
      ...validDefinition(),
      rootMissionId: 'mission-not-node',
    };

    expect(() => validateMissionDAGDefinition({
      value: missingRootNode,
      knownMissionIds: ['mission-root', 'mission-market', 'mission-product', 'mission-not-node'],
    })).toThrow(/MISSION_DAG_INVALID_ROOT/);

    expect(() => validateMissionDAGDefinition({
      value: validDefinition(),
      knownMissionIds: ['mission-market', 'mission-product'],
    })).toThrow(/MISSION_DAG_UNKNOWN_ROOT_MISSION/);
  });

  it('T-MDAG-V7 rejects cycles deterministically', () => {
    const definition = {
      ...validDefinition(),
      edges: [
        { parentMissionId: 'mission-root', childMissionId: 'mission-market' },
        { parentMissionId: 'mission-market', childMissionId: 'mission-product' },
        { parentMissionId: 'mission-product', childMissionId: 'mission-root' },
      ],
    };

    expect(() => validateMissionDAGDefinition({
      value: definition,
      knownMissionIds: ['mission-root', 'mission-market', 'mission-product'],
    })).toThrow(/MISSION_DAG_CYCLE_DETECTED/);
  });
});
