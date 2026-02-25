import { describe, expect, it, beforeEach } from 'vitest';

import { appendSwarmLog, clearSwarmLogForTests, getSwarmLog } from './log.ts';
import { canonicalStringify, sha256 } from '../finance/determinism.ts';

beforeEach(() => {
  clearSwarmLogForTests();
});

describe('swarm log', () => {
  it('appends entries in deterministic order', () => {
    appendSwarmLog({
      runId: 'run-1',
      stepIndex: 2,
      roleId: 'b',
      outputHash: 'hash-2',
      status: 'ok'
    });
    appendSwarmLog({
      runId: 'run-1',
      stepIndex: 1,
      roleId: 'a',
      outputHash: 'hash-1',
      status: 'ok'
    });

    const entries = getSwarmLog('run-1');
    expect(entries.map((entry) => entry.stepIndex)).toEqual([1, 2]);
  });

  it('derives entry ids deterministically', () => {
    appendSwarmLog({
      runId: 'run-2',
      stepIndex: 3,
      roleId: 'c',
      outputHash: 'hash-3',
      status: 'ok'
    });

    const [entry] = getSwarmLog('run-2');
    const expected = sha256(canonicalStringify({ runId: 'run-2', stepIndex: 3 }));
    expect(entry.entryId).toBe(expected);
  });
});
