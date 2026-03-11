import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeMarketSynthesisEventDedupeKey,
  createMarketSynthesisHistoryStore
} from './market-synthesis-history-store.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-market-synthesis-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('market-synthesis history store', () => {
  it('T-MS-H1 appends deterministic events and dedupes by fingerprint', () => {
    const store = createMarketSynthesisHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'market-synthesis')
    });

    const first = store.append({
      marketSynthesisId: 'market-risk-synthesis',
      eventType: 'market_synthesis_initialized',
      reason: 'market_synthesis_projection_generated',
      linkedCrossSwarmIds: ['b', 'a'],
      slotReference: 'daily:2026-03-11'
    });

    const second = store.append({
      marketSynthesisId: 'market-risk-synthesis',
      eventType: 'market_synthesis_initialized',
      reason: 'market_synthesis_projection_generated',
      linkedCrossSwarmIds: ['a', 'b'],
      slotReference: 'daily:2026-03-11'
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(store.load('market-risk-synthesis').entries[0]?.linkedCrossSwarmIds).toEqual(['a', 'b']);
  });

  it('T-MS-H2 keeps stable ordering', () => {
    const store = createMarketSynthesisHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'market-synthesis')
    });

    store.append({
      marketSynthesisId: 'market-risk-synthesis',
      eventType: 'market_completed',
      reason: 'done',
      linkedCrossSwarmIds: ['a'],
      slotReference: 'daily:2026-03-12'
    });

    store.append({
      marketSynthesisId: 'market-risk-synthesis',
      eventType: 'readiness_changed',
      reason: 'analyzing',
      linkedCrossSwarmIds: ['a'],
      slotReference: 'daily:2026-03-11'
    });

    const loaded = store.load('market-risk-synthesis');
    expect(loaded.entries.map((entry) => entry.slotReference)).toEqual(['daily:2026-03-12', 'daily:2026-03-11']);
  });

  it('T-MS-H3 dedupe fingerprint is deterministic', () => {
    const input = {
      marketSynthesisId: 'market-risk-synthesis',
      eventType: 'market_progressed' as const,
      reason: 'market_lifecycle_progressing',
      linkedCrossSwarmIds: ['a'],
      slotReference: 'daily:2026-03-11'
    };

    expect(computeMarketSynthesisEventDedupeKey(input)).toBe(computeMarketSynthesisEventDedupeKey(input));
  });
});
