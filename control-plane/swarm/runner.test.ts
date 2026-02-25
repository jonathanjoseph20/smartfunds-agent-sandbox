import { beforeEach, describe, expect, it } from 'vitest';

import { runSwarm } from './runner.ts';
import { clearSwarmRegistryForTests, registerSwarm, normalizeSwarmDefinition } from './registry.ts';
import { clearSwarmLogForTests, getSwarmLog } from './log.ts';
import { canonicalStringify, sha256 } from '../finance/determinism.ts';
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
  clearSwarmLogForTests();
});

describe('swarm runner', () => {
  it('derives stable run ids and step hashes', () => {
    registerSwarm(baseSwarm());

    const input = { swarmId: 'alpha-swarm', payload: { requestId: 'req-1' } };
    const result = runSwarm(input);
    const expectedRunId = sha256(canonicalStringify({ swarmId: 'alpha-swarm', payload: input.payload }));

    expect(result.runId).toBe(expectedRunId);
    expect(result.stepResults).toHaveLength(2);
    expect(result.stepResults[0].outputHash).toBe(
      sha256(canonicalStringify(result.stepResults[0].output))
    );

    const logEntries = getSwarmLog(result.runId);
    expect(logEntries.map((entry) => entry.stepIndex)).toEqual([1, 2]);
  });

  it('fails when swarmId is missing', () => {
    expect(() => runSwarm({ swarmId: '', payload: {} })).toThrow(/ERR_SWARM_ID_REQUIRED/);
  });

  it('fails when swarmId is unknown', () => {
    expect(() => runSwarm({ swarmId: 'missing', payload: {} })).toThrow(/ERR_SWARM_NOT_FOUND/);
  });

  it('rejects duplicate step indexes during normalization', () => {
    const def = baseSwarm({
      steps: [
        { stepIndex: 1, roleId: 'builder', action: 'draft' },
        { stepIndex: 1, roleId: 'reviewer', action: 'review' }
      ]
    });

    expect(() => normalizeSwarmDefinition(def)).toThrow(/ERR_SWARM_DUPLICATE_STEP_INDEX/);
  });

  it('rejects duplicate role ids during normalization', () => {
    const def = baseSwarm({
      roles: [
        { roleId: 'builder', description: 'Builds' },
        { roleId: 'builder', description: 'Builds again' }
      ]
    });

    expect(() => normalizeSwarmDefinition(def)).toThrow(/ERR_SWARM_DUPLICATE_ROLE_ID/);
  });
});
