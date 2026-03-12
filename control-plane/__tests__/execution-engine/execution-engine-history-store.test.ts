import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeExecutionEngineEventDedupeKey,
  createExecutionEngineHistoryStore,
} from '../../execution-engine/execution-engine-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-engine-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution engine history store', () => {
  it('T-MEE-H1 append-only behavior and dedupe are deterministic', () => {
    const store = createExecutionEngineHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      executionJournalId: 'ej-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      eventType: 'engine_run_initialized',
      reasoning: 'initialized',
      payload: { engineState: 'initialized' },
    });

    const second = store.append({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      executionJournalId: 'ej-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      eventType: 'engine_run_initialized',
      reasoning: 'initialized',
      payload: { engineState: 'initialized' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MEE-H2 ordering and repeated loads are stable', () => {
    const store = createExecutionEngineHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      executionJournalId: 'ej-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      eventType: 'engine_run_started',
      reasoning: 'started',
      payload: {},
    });

    store.append({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      executionJournalId: 'ej-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      eventType: 'engine_run_completed',
      reasoning: 'completed',
      payload: {},
    });

    const first = store.load({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      executionJournalId: 'ej-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
    });
    const second = store.load({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      executionJournalId: 'ej-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
    });

    expect(first).toEqual(second);
    expect([...first.entries].sort((left, right) => left.eventDedupeKey.localeCompare(right.eventDedupeKey))).toEqual(first.entries);
  });

  it('T-MEE-H3 event dedupe key is deterministic', () => {
    const input = {
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      executionJournalId: 'ej-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      eventType: 'engine_run_failed' as const,
      reasoning: 'failed',
      payload: { failureReason: 'intentional' },
    };

    expect(computeExecutionEngineEventDedupeKey(input)).toBe(computeExecutionEngineEventDedupeKey(input));
  });
});
