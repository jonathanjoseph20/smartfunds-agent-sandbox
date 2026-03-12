import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeExecutionAttemptEventDedupeKey,
  createExecutionAttemptHistoryStore,
} from '../../execution-attempt/execution-attempt-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-attempt-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution attempt history store', () => {
  it('T-MEA-H1 append-only behavior and dedupe are deterministic', () => {
    const store = createExecutionAttemptHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'execution_attempt_created',
      reasoning: 'created',
      payload: { state: 'prepared' },
    });

    const second = store.append({
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'execution_attempt_created',
      reasoning: 'created',
      payload: { state: 'prepared' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MEA-H2 ordering and repeated loads are stable', () => {
    const store = createExecutionAttemptHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'execution_attempt_status_evaluated',
      reasoning: 'evaluated',
      payload: {},
    });

    store.append({
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'execution_attempt_materialized',
      reasoning: 'materialized',
      payload: {},
    });

    const first = store.load({ executionAttemptId: 'ea-1', runtimeEnvelopeId: 're-1', executionContractId: 'ec-1', missionId: 'm1' });
    const second = store.load({ executionAttemptId: 'ea-1', runtimeEnvelopeId: 're-1', executionContractId: 'ec-1', missionId: 'm1' });

    expect(first).toEqual(second);
    expect([...first.entries].sort((left, right) => left.eventDedupeKey.localeCompare(right.eventDedupeKey))).toEqual(first.entries);
  });

  it('T-MEA-H3 event dedupe key is deterministic', () => {
    const input = {
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'execution_attempt_cancelled' as const,
      reasoning: 'cancelled',
      payload: { reason: 'manual cancellation' },
    };

    expect(computeExecutionAttemptEventDedupeKey(input)).toBe(computeExecutionAttemptEventDedupeKey(input));
  });
});
