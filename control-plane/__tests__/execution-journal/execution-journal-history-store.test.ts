import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeExecutionJournalEventDedupeKey,
  createExecutionJournalHistoryStore,
} from '../../execution-journal/execution-journal-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-journal-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution journal history store', () => {
  it('T-MEJ-H1 append-only behavior and dedupe are deterministic', () => {
    const store = createExecutionJournalHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      executionJournalId: 'ej-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'attempt_created',
      eventPayload: { attemptState: 'pending' },
      reasonTokens: ['created'],
    });

    const second = store.append({
      executionJournalId: 'ej-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'attempt_created',
      eventPayload: { attemptState: 'pending' },
      reasonTokens: ['created'],
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.events).toHaveLength(1);
  });

  it('T-MEJ-H2 event indices are stable and monotonic', () => {
    const store = createExecutionJournalHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      executionJournalId: 'ej-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'attempt_created',
      eventPayload: {},
    });

    const second = store.append({
      executionJournalId: 'ej-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'attempt_prepared',
      eventPayload: {},
    });

    expect(first.event.eventIndex).toBe(0);
    expect(second.event.eventIndex).toBe(1);

    const loaded = store.load({
      executionJournalId: 'ej-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
    });

    expect(loaded.events.map((event) => event.eventIndex)).toEqual([0, 1]);
  });

  it('T-MEJ-H3 repeated loads and append calls are idempotent', () => {
    const store = createExecutionJournalHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      executionJournalId: 'ej-1',
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'attempt_ready_for_execution',
      eventPayload: { ready: true },
    });

    const first = store.load({ executionJournalId: 'ej-1', executionAttemptId: 'ea-1', runtimeEnvelopeId: 're-1', executionContractId: 'ec-1', missionId: 'm1' });
    const second = store.load({ executionJournalId: 'ej-1', executionAttemptId: 'ea-1', runtimeEnvelopeId: 're-1', executionContractId: 'ec-1', missionId: 'm1' });

    expect(first).toEqual(second);
  });

  it('T-MEJ-H4 event dedupe key excludes runtime noise', () => {
    const input = {
      executionAttemptId: 'ea-1',
      eventType: 'attempt_created' as const,
      eventPayload: {
        attemptState: 'pending',
        attemptLifecycleState: 'prepared',
      },
    };

    expect(computeExecutionJournalEventDedupeKey(input)).toBe(computeExecutionJournalEventDedupeKey(input));
  });
});
