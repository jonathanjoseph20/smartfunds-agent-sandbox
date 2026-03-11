import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeMissionEventDedupeKey,
  createMissionHistoryStore,
} from '../../missions/mission-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission history store', () => {
  it('T-MH1 appends append-only events and dedupes repeated writes', () => {
    const store = createMissionHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'missions'),
    });

    const first = store.append({
      missionId: 'mission-1',
      eventType: 'mission_created',
      payload: { missionType: 'produce-market-memo' },
      reasoning: 'mission_instance_created',
      slotReference: 'slot:2026-03-11',
    });

    const second = store.append({
      missionId: 'mission-1',
      eventType: 'mission_created',
      payload: { missionType: 'produce-market-memo' },
      reasoning: 'mission_instance_created',
      slotReference: 'slot:2026-03-11',
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(store.load('mission-1').entries).toHaveLength(1);
  });

  it('T-MH2 keeps deterministic ordering by slot and dedupe key', () => {
    const store = createMissionHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'missions'),
    });

    store.append({
      missionId: 'mission-1',
      eventType: 'mission_completed',
      payload: { state: 'completed' },
      reasoning: 'all_deliverables_satisfied',
      slotReference: 'slot:2026-03-12',
    });

    store.append({
      missionId: 'mission-1',
      eventType: 'mission_approved',
      payload: { state: 'approved' },
      reasoning: 'founder_approval_recorded',
      slotReference: 'slot:2026-03-11',
    });

    const loaded = store.load('mission-1');
    expect(loaded.entries.map((entry) => entry.slotReference)).toEqual(['slot:2026-03-12', 'slot:2026-03-11']);
  });

  it('T-MH3 dedupe key is deterministic', () => {
    const input = {
      missionId: 'mission-1',
      eventType: 'source_reference_added' as const,
      payload: { sourceId: 'memo-1', sourceKind: 'memo' },
      reasoning: 'source_reference_added',
      slotReference: 'slot:2026-03-11',
    };

    expect(computeMissionEventDedupeKey(input)).toBe(computeMissionEventDedupeKey(input));
  });
});
