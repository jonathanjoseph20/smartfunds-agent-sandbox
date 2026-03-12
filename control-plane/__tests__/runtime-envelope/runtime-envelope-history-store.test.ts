import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeRuntimeEnvelopeEventDedupeKey,
  createRuntimeEnvelopeHistoryStore,
} from '../../runtime-envelope/runtime-envelope-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-runtime-envelope-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('runtime envelope history store', () => {
  it('T-MRE-H1 append-only behavior and dedupe are deterministic', () => {
    const store = createRuntimeEnvelopeHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'runtime_envelope_evaluated',
      reasoning: 'evaluated',
      payload: { state: 'evaluated' },
    });

    const second = store.append({
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'runtime_envelope_evaluated',
      reasoning: 'evaluated',
      payload: { state: 'evaluated' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MRE-H2 ordering and repeated loads are stable', () => {
    const store = createRuntimeEnvelopeHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'runtime_envelope_confirmed',
      reasoning: 'confirmed',
      payload: { reviewedBy: 'founder' },
    });

    store.append({
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'runtime_envelope_materialized',
      reasoning: 'materialized',
      payload: {},
    });

    const first = store.load({ runtimeEnvelopeId: 're-1', executionContractId: 'ec-1', missionId: 'm1' });
    const second = store.load({ runtimeEnvelopeId: 're-1', executionContractId: 'ec-1', missionId: 'm1' });

    expect(first).toEqual(second);
    expect([...first.entries].sort((left, right) => left.eventDedupeKey.localeCompare(right.eventDedupeKey))).toEqual(first.entries);
  });

  it('T-MRE-H3 event dedupe key is deterministic', () => {
    const input = {
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      eventType: 'runtime_envelope_rejected' as const,
      reasoning: 'rejected',
      payload: { reason: 'manual rejection' },
    };

    expect(computeRuntimeEnvelopeEventDedupeKey(input)).toBe(computeRuntimeEnvelopeEventDedupeKey(input));
  });
});
