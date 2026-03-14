import { describe, expect, it } from 'vitest';

import {
  deriveCodexExecutionPacketId,
  normalizeCodexExecutionPacketIdentityPayload,
} from '../../codex/codex-execution-packet-identity.ts';

describe('codex execution packet identity', () => {
  it('T-PF4-I1 same payload yields same packetId', () => {
    const payload = {
      graphId: 'graph-1',
      taskId: 'task-1',
      promptTemplate: 'prompt',
      expectedArtifacts: ['a.ts', 'b.ts'],
      validationRules: ['rule-a', 'rule-b'],
      dependencies: ['task-0'],
      subsystem: 'api',
      phase: 'phase-1',
    };

    expect(deriveCodexExecutionPacketId(payload)).toBe(deriveCodexExecutionPacketId(payload));
  });

  it('T-PF4-I2 reordered arrays normalize to same packetId', () => {
    const first = {
      graphId: 'graph-1',
      taskId: 'task-1',
      promptTemplate: 'prompt',
      expectedArtifacts: ['b.ts', 'a.ts'],
      validationRules: ['rule-b', 'rule-a'],
      dependencies: ['task-2', 'task-1'],
      subsystem: 'api',
      phase: 'phase-1',
    };

    const second = {
      ...first,
      expectedArtifacts: ['a.ts', 'b.ts'],
      validationRules: ['rule-a', 'rule-b'],
      dependencies: ['task-1', 'task-2'],
    };

    expect(deriveCodexExecutionPacketId(first)).toBe(deriveCodexExecutionPacketId(second));
    expect(normalizeCodexExecutionPacketIdentityPayload(first)).toEqual(normalizeCodexExecutionPacketIdentityPayload(second));
  });

  it('T-PF4-I3 excluded fields do not affect identity', () => {
    const base = {
      graphId: 'graph-1',
      taskId: 'task-1',
      promptTemplate: 'prompt',
      expectedArtifacts: ['a.ts'],
      validationRules: ['rule-a'],
      dependencies: [],
      subsystem: 'api',
      phase: 'phase-1',
    };

    const packetWithDifferentStatusOne = {
      ...base,
      status: 'draft',
      materializedPath: 'artifacts/codex/x',
    };

    const packetWithDifferentStatusTwo = {
      ...base,
      status: 'ready',
      materializedPath: 'artifacts/codex/y',
    };

    expect(deriveCodexExecutionPacketId(base)).toBe(
      deriveCodexExecutionPacketId({
        ...packetWithDifferentStatusOne,
      }),
    );
    expect(deriveCodexExecutionPacketId(base)).toBe(
      deriveCodexExecutionPacketId({
        ...packetWithDifferentStatusTwo,
      }),
    );
  });
});
