import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createRuntimeOutcomePropagationHistoryStore } from '../../mission-control/runtime-outcome-propagation-history-store.ts';
import { createRuntimeOutcomePropagationRecord } from '../../mission-control/runtime-outcome-propagation-record.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-runtime-outcome-propagation-record');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runtime outcome propagation record', () => {
  it('T-ROP-R1 deterministic identity is replay-stable', () => {
    const left = createRuntimeOutcomePropagationRecord({
      activationDispatchAttemptId: 'attempt-1',
      executionActivationRecordId: 'activation-1',
      executionRequestRecordId: 'request-1',
      runtimeStatus: 'runtime_completed',
      outcome: 'upstream_updated',
    });

    const right = createRuntimeOutcomePropagationRecord({
      activationDispatchAttemptId: 'attempt-1',
      executionActivationRecordId: 'activation-1',
      executionRequestRecordId: 'request-1',
      runtimeStatus: 'runtime_completed',
      outcome: 'upstream_updated',
    });

    expect(left.runtimeOutcomePropagationRecordId).toBe(right.runtimeOutcomePropagationRecordId);
  });

  it('T-ROP-R2 history ordering and duplicate rejection are deterministic', () => {
    const store = createRuntimeOutcomePropagationHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-control'),
    });

    const record = createRuntimeOutcomePropagationRecord({
      activationDispatchAttemptId: 'attempt-1',
      executionActivationRecordId: 'activation-1',
      executionRequestRecordId: 'request-1',
      runtimeStatus: 'runtime_completed',
      outcome: 'upstream_updated',
    });

    const first = store.appendEvent({
      runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
      eventType: 'runtime_outcome_propagation_record_created',
      reasonTokens: ['a'],
      payload: { value: 'x' },
    });

    const duplicate = store.appendEvent({
      runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
      eventType: 'runtime_outcome_propagation_record_created',
      reasonTokens: ['a'],
      payload: { value: 'x' },
    });

    const second = store.appendEvent({
      runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId,
      eventType: 'mission_portfolio_state_propagated',
      reasonTokens: ['b'],
      payload: { value: 'y' },
    });

    expect(first.appended).toBe(true);
    expect(duplicate.appended).toBe(false);
    expect(second.appended).toBe(true);

    const replay = store.replay({ runtimeOutcomePropagationRecordId: record.runtimeOutcomePropagationRecordId });
    expect(replay).toHaveLength(2);
    expect(replay.map((entry) => entry.eventDedupeKey)).toEqual([...replay.map((entry) => entry.eventDedupeKey)].sort());
  });
});
