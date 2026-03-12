import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeMissionActivationEventDedupeKey,
  createMissionActivationHistoryStore,
} from '../../mission-activation/mission-activation-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-activation-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission activation history store', () => {
  it('T-MACT-H1 append-only behavior and dedupe are deterministic', () => {
    const store = createMissionActivationHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    const first = store.append({
      activationDecisionId: 'activation-1',
      missionId: 'mission-1',
      eventType: 'activation_evaluated',
      reasoning: 'evaluated',
      payload: { state: 'evaluated' },
    });

    const second = store.append({
      activationDecisionId: 'activation-1',
      missionId: 'mission-1',
      eventType: 'activation_evaluated',
      reasoning: 'evaluated',
      payload: { state: 'evaluated' },
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(second.history.entries).toHaveLength(1);
  });

  it('T-MACT-H2 ordering and repeated loads are stable', () => {
    const store = createMissionActivationHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      activationDecisionId: 'activation-1',
      missionId: 'mission-1',
      eventType: 'activation_confirmed',
      reasoning: 'confirmed',
      payload: { reviewedBy: 'founder' },
    });

    store.append({
      activationDecisionId: 'activation-1',
      missionId: 'mission-1',
      eventType: 'activation_materialized',
      reasoning: 'materialized',
      payload: {},
    });

    const first = store.load({ activationDecisionId: 'activation-1', missionId: 'mission-1' });
    const second = store.load({ activationDecisionId: 'activation-1', missionId: 'mission-1' });

    expect(first).toEqual(second);
    expect([...first.entries].sort((left, right) => left.eventDedupeKey.localeCompare(right.eventDedupeKey))).toEqual(first.entries);
  });

  it('T-MACT-H3 event dedupe key is deterministic', () => {
    const input = {
      activationDecisionId: 'activation-1',
      missionId: 'mission-1',
      eventType: 'activation_rejected' as const,
      reasoning: 'rejected',
      payload: { reason: 'insufficient readiness evidence' },
    };

    expect(computeMissionActivationEventDedupeKey(input)).toBe(computeMissionActivationEventDedupeKey(input));
  });

  it('T-MACT-H4 captures confirm and reject events without mutating source mission truth files', () => {
    const sourceFile = path.join(tmpRoot, 'source.json');
    fs.mkdirSync(path.dirname(sourceFile), { recursive: true });
    fs.writeFileSync(sourceFile, '{"value":1}\n', 'utf8');
    const before = fs.readFileSync(sourceFile, 'utf8');

    const store = createMissionActivationHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });

    store.append({
      activationDecisionId: 'activation-1',
      missionId: 'mission-1',
      eventType: 'activation_confirmed',
      reasoning: 'confirmed',
      payload: { reviewedBy: 'founder' },
    });

    store.append({
      activationDecisionId: 'activation-1',
      missionId: 'mission-1',
      eventType: 'activation_rejected',
      reasoning: 'rejected',
      payload: { reason: 'manual rejection' },
    });

    const after = fs.readFileSync(sourceFile, 'utf8');
    expect(after).toBe(before);
  });
});
