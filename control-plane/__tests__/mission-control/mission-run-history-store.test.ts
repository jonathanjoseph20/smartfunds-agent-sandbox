import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeMissionRunHistoryEventDedupeKey,
  createMissionRunHistoryStore,
} from '../../mission-control/mission-run-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-control-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission run history store', () => {
  it('T-MC-HS1 appends deterministically and dedupes equivalent entries', () => {
    const store = createMissionRunHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      eventType: 'mission_run_created',
      reason: 'created',
      payload: { state: 'created' },
    });

    const second = store.append({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      eventType: 'mission_run_created',
      reason: 'created',
      payload: { state: 'created' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MC-HS2 keeps stable ordering and repeated load consistency', () => {
    const store = createMissionRunHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      eventType: 'mission_degraded',
      reason: 'degraded',
      payload: {},
    });

    store.append({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      eventType: 'mission_progress_updated',
      reason: 'progress',
      payload: {},
    });

    const first = store.load({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
    });

    const second = store.load({
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
    });

    expect(second).toEqual(first);
    expect([...first.entries].sort((a, b) => a.eventDedupeKey.localeCompare(b.eventDedupeKey))).toEqual(first.entries);
  });

  it('T-MC-HS3 computes deterministic history dedupe key', () => {
    const input = {
      missionRunId: 'run-1',
      missionId: 'mission-1',
      executionAttemptId: 'attempt-1',
      runtimeEnvelopeId: 'envelope-1',
      executionContractId: 'contract-1',
      eventType: 'mission_escalated' as const,
      reason: 'escalated',
      payload: { escalationCount: 2 },
    };

    expect(computeMissionRunHistoryEventDedupeKey(input)).toBe(computeMissionRunHistoryEventDedupeKey(input));
  });
});
