import { beforeEach, describe, expect, it } from 'vitest';

import { clearSwarmRegistryForTests, getSwarm, listSwarms, registerSwarm } from './registry.ts';
import type { SwarmDefinition } from './types.ts';

function baseSwarm(overrides: Partial<SwarmDefinition> = {}): SwarmDefinition {
  return {
    swarmId: 'alpha-swarm',
    mode: 'structured',
    roles: [
      { roleId: 'builder', description: 'Builds' },
      { roleId: 'reviewer', description: 'Reviews' }
    ],
    steps: [
      { stepIndex: 1, roleId: 'builder', action: 'draft' },
      { stepIndex: 2, roleId: 'reviewer', action: 'review' }
    ],
    ...overrides
  };
}

beforeEach(() => {
  clearSwarmRegistryForTests();
});

describe('swarm registry', () => {
  it('registers and retrieves normalized swarms deterministically', () => {
    registerSwarm(
      baseSwarm({
        roles: [
          { roleId: 'reviewer', description: 'Reviews' },
          { roleId: 'builder', description: 'Builds' }
        ],
        steps: [
          { stepIndex: 2, roleId: 'reviewer', action: 'review' },
          { stepIndex: 1, roleId: 'builder', action: 'draft' }
        ]
      })
    );

    const swarm = getSwarm('alpha-swarm');
    expect(swarm.roles.map((role) => role.roleId)).toEqual(['builder', 'reviewer']);
    expect(swarm.steps.map((step) => step.stepIndex)).toEqual([1, 2]);
  });

  it('rejects duplicate swarm ids', () => {
    registerSwarm(baseSwarm());
    expect(() => registerSwarm(baseSwarm())).toThrow(/ERR_SWARM_DUPLICATE_ID/);
  });

  it('returns frozen swarms', () => {
    registerSwarm(baseSwarm());
    const swarm = getSwarm('alpha-swarm');
    expect(Object.isFrozen(swarm)).toBe(true);
    expect(Object.isFrozen(swarm.roles)).toBe(true);
    expect(Object.isFrozen(swarm.steps)).toBe(true);
  });

  it('lists swarms in stable order', () => {
    registerSwarm(baseSwarm({ swarmId: 'beta-swarm' }));
    registerSwarm(baseSwarm({ swarmId: 'alpha-swarm' }));

    const list = listSwarms();
    expect(list.map((swarm) => swarm.swarmId)).toEqual(['alpha-swarm', 'beta-swarm']);
  });
});
