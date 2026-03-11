import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computePortfolioEventDedupeKey,
  createPortfolioHistoryStore
} from './portfolio-history-store.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-portfolio-intelligence-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('portfolio-intelligence history store', () => {
  it('T-PI-H1 appends deterministic events and dedupes by fingerprint', () => {
    const store = createPortfolioHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'portfolio-intelligence')
    });

    const first = store.append({
      portfolioId: 'defi-core-portfolio',
      eventType: 'portfolio_initialized',
      reason: 'portfolio_projection_generated',
      linkedMarketSynthesisIds: ['b', 'a'],
      slotReference: 'daily:2026-03-11'
    });

    const second = store.append({
      portfolioId: 'defi-core-portfolio',
      eventType: 'portfolio_initialized',
      reason: 'portfolio_projection_generated',
      linkedMarketSynthesisIds: ['a', 'b'],
      slotReference: 'daily:2026-03-11'
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(store.load('defi-core-portfolio').entries[0]?.linkedMarketSynthesisIds).toEqual(['a', 'b']);
  });

  it('T-PI-H2 keeps stable ordering', () => {
    const store = createPortfolioHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'portfolio-intelligence')
    });

    store.append({
      portfolioId: 'defi-core-portfolio',
      eventType: 'portfolio_completed',
      reason: 'done',
      linkedMarketSynthesisIds: ['a'],
      slotReference: 'daily:2026-03-12'
    });

    store.append({
      portfolioId: 'defi-core-portfolio',
      eventType: 'readiness_changed',
      reason: 'analyzing',
      linkedMarketSynthesisIds: ['a'],
      slotReference: 'daily:2026-03-11'
    });

    const loaded = store.load('defi-core-portfolio');
    expect(loaded.entries.map((entry) => entry.slotReference)).toEqual(['daily:2026-03-12', 'daily:2026-03-11']);
  });

  it('T-PI-H3 dedupe fingerprint is deterministic', () => {
    const input = {
      portfolioId: 'defi-core-portfolio',
      eventType: 'portfolio_progressed' as const,
      reason: 'portfolio_lifecycle_progressing',
      linkedMarketSynthesisIds: ['a'],
      slotReference: 'daily:2026-03-11'
    };

    expect(computePortfolioEventDedupeKey(input)).toBe(computePortfolioEventDedupeKey(input));
  });

  it('T-PI-H4 appends readiness change event type', () => {
    const store = createPortfolioHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'portfolio-intelligence')
    });

    const result = store.append({
      portfolioId: 'defi-core-portfolio',
      eventType: 'readiness_changed',
      reason: 'portfolio_readiness_analyzing',
      linkedMarketSynthesisIds: ['m1']
    });

    expect(result.appended).toBe(true);
    expect(result.entry.eventType).toBe('readiness_changed');
  });
});
