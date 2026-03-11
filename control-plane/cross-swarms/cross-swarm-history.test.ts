import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeCrossSwarmEventDedupeKey,
  createCrossSwarmHistoryStore
} from './cross-swarm-history.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-cross-swarm-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('cross-swarm history store', () => {
  it('T-CS-H1 records initialization and dedupes deterministic events', () => {
    const store = createCrossSwarmHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'cross-swarms')
    });

    const first = store.append({
      crossSwarmId: 'protocol-response-cluster',
      eventType: 'cross_swarm_initialized',
      reason: 'cross_swarm_projection_generated',
      lifecycleState: 'active',
      readinessState: 'analyzing',
      completionSatisfied: false,
      linkedSwarmIds: ['b', 'a'],
      blockers: ['x'],
      conflicts: [],
      slotReference: 'daily:2026-03-11'
    });

    const second = store.append({
      crossSwarmId: 'protocol-response-cluster',
      eventType: 'cross_swarm_initialized',
      reason: 'cross_swarm_projection_generated',
      lifecycleState: 'active',
      readinessState: 'analyzing',
      completionSatisfied: false,
      linkedSwarmIds: ['a', 'b'],
      blockers: ['x'],
      conflicts: [],
      slotReference: 'daily:2026-03-11'
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(store.load('protocol-response-cluster').entries[0]?.linkedSwarmIds).toEqual(['a', 'b']);
  });

  it('T-CS-H2 records readiness and completion events in stable order', () => {
    const store = createCrossSwarmHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'cross-swarms')
    });

    store.append({
      crossSwarmId: 'protocol-response-cluster',
      eventType: 'coordination_completed',
      reason: 'done',
      lifecycleState: 'completed',
      readinessState: 'coherent',
      completionSatisfied: true,
      linkedSwarmIds: ['a'],
      blockers: [],
      conflicts: [],
      slotReference: 'daily:2026-03-12'
    });

    store.append({
      crossSwarmId: 'protocol-response-cluster',
      eventType: 'readiness_changed',
      reason: 'coherent',
      lifecycleState: 'stabilizing',
      readinessState: 'coherent',
      completionSatisfied: false,
      linkedSwarmIds: ['a'],
      blockers: [],
      conflicts: [],
      slotReference: 'daily:2026-03-11'
    });

    const loaded = store.load('protocol-response-cluster');
    expect(loaded.entries.map((entry) => entry.slotReference)).toEqual(['daily:2026-03-12', 'daily:2026-03-11']);
  });

  it('T-CS-H3 dedupe key is deterministic', () => {
    const input = {
      crossSwarmId: 'protocol-response-cluster',
      eventType: 'coordination_progressed' as const,
      reason: 'cross_swarm_lifecycle_progressing',
      lifecycleState: 'progressing' as const,
      readinessState: 'analyzing' as const,
      completionSatisfied: false,
      linkedSwarmIds: ['a'],
      blockers: ['x'],
      conflicts: [],
      slotReference: 'daily:2026-03-11'
    };

    expect(computeCrossSwarmEventDedupeKey(input)).toBe(computeCrossSwarmEventDedupeKey(input));
  });
});
