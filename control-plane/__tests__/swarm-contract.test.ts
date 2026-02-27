import { describe, expect, it } from 'vitest';

import { computeSwarmRunHash } from '../swarm/determinism.ts';
import { validateSwarmRun, type SwarmRun } from '../swarm/schema.ts';

function baseRun(): SwarmRun {
  return {
    schemaVersion: 'swarm/v1',
    swarmId: 'swarm-contract-v1',
    mode: 'structured',
    teamId: 'governance',
    goal: 'Formalize swarm contract metadata',
    tasks: [
      {
        taskId: 'task-1',
        kind: 'plan',
        summary: 'Plan work',
        ownedPathsHint: ['control-plane/swarm/**'],
        dependsOn: []
      }
    ],
    policy: {
      maxRetries: 2,
      allowedModes: ['structured', 'autonomous'],
      allowCrossMode: false
    }
  };
}

describe('swarm contract v1', () => {
  it('T-SW1 computes a stable hash for equivalent input', () => {
    const runA = baseRun();
    const runB: SwarmRun = {
      goal: 'Formalize swarm contract metadata',
      mode: 'structured',
      policy: {
        allowCrossMode: false,
        allowedModes: ['structured', 'autonomous'],
        maxRetries: 2
      },
      schemaVersion: 'swarm/v1',
      swarmId: 'swarm-contract-v1',
      tasks: [
        {
          dependsOn: [],
          kind: 'plan',
          ownedPathsHint: ['control-plane/swarm/**'],
          summary: 'Plan work',
          taskId: 'task-1'
        }
      ],
      teamId: 'governance'
    };

    expect(computeSwarmRunHash(runA)).toBe(computeSwarmRunHash(runB));
  });

  it('T-SW2 changes hash when semantics change', () => {
    const runA = baseRun();
    const runB = { ...baseRun(), goal: 'Changed goal' };

    expect(computeSwarmRunHash(runA)).not.toBe(computeSwarmRunHash(runB));
  });

  it('T-SW3 validates and normalizes task defaults deterministically', () => {
    const result = validateSwarmRun({
      schemaVersion: 'swarm/v1',
      swarmId: 'swarm-contract-v1',
      mode: 'autonomous',
      teamId: null,
      goal: 'Test defaults',
      tasks: [{ taskId: 'task-1', kind: 'test', summary: 'Execute tests' }],
      policy: {
        maxRetries: 1,
        allowedModes: ['autonomous'],
        allowCrossMode: false
      }
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.tasks[0].ownedPathsHint).toEqual([]);
      expect(result.value.tasks[0].dependsOn).toEqual([]);
    }
  });

  it('T-SW4 rejects missing required fields', () => {
    const result = validateSwarmRun({
      swarmId: '',
      mode: 'invalid',
      goal: '',
      tasks: [],
      policy: { maxRetries: -1, allowedModes: [], allowCrossMode: 'no' }
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('schemaVersion must be "swarm/v1".');
      expect(result.errors.join('\n')).toContain('swarmId must be a non-empty string.');
      expect(result.errors.join('\n')).toContain('mode must be either structured or autonomous.');
    }
  });
});
