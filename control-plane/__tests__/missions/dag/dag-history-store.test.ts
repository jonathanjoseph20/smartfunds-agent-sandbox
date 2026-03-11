import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeMissionDAGEventDedupeKey,
  createMissionDAGHistoryStore,
} from '../../../missions/dag/mission-dag-history-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-mission-dag-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('mission DAG history store', () => {
  it('T-MDAG-H1 appends append-only events and dedupes repeated writes', () => {
    const store = createMissionDAGHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-dags'),
    });

    const first = store.append({
      dagId: 'dag-1',
      eventType: 'dag_created',
      payload: { rootMissionId: 'mission-root' },
      reasoning: 'dag_definition_created',
      slotReference: 'slot:2026-03-11',
    });

    const second = store.append({
      dagId: 'dag-1',
      eventType: 'dag_created',
      payload: { rootMissionId: 'mission-root' },
      reasoning: 'dag_definition_created',
      slotReference: 'slot:2026-03-11',
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(store.load('dag-1').entries).toHaveLength(1);
  });

  it('T-MDAG-H2 keeps deterministic ordering by slot and dedupe key', () => {
    const store = createMissionDAGHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'mission-dags'),
    });

    store.append({
      dagId: 'dag-1',
      eventType: 'dependency_added',
      payload: { parentMissionId: 'mission-root', childMissionId: 'mission-market' },
      reasoning: 'dependency_added',
      slotReference: 'slot:2026-03-12',
    });

    store.append({
      dagId: 'dag-1',
      eventType: 'mission_added',
      payload: { missionId: 'mission-market' },
      reasoning: 'mission_added',
      slotReference: 'slot:2026-03-11',
    });

    const loaded = store.load('dag-1');
    expect(loaded.entries.map((entry) => entry.slotReference)).toEqual(['slot:2026-03-12', 'slot:2026-03-11']);
  });

  it('T-MDAG-H3 dedupe key is deterministic', () => {
    const input = {
      dagId: 'dag-1',
      eventType: 'mission_added' as const,
      payload: { missionId: 'mission-root' },
      reasoning: 'mission_added',
      slotReference: 'slot:2026-03-11',
    };

    expect(computeMissionDAGEventDedupeKey(input)).toBe(computeMissionDAGEventDedupeKey(input));
  });
});
