import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computePortfolioActionEventDedupeKey,
  createPortfolioActionHistoryStore,
} from './portfolio-action-history-store.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-portfolio-actions-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('portfolio-actions history store', () => {
  it('T-PA-H1 appends deterministic events and dedupes by fingerprint', () => {
    const store = createPortfolioActionHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'portfolio-actions')
    });

    const first = store.append({
      actionId: 'reduce-risk-exposure',
      eventType: 'action_initialized',
      reason: 'portfolio_action_projection_generated',
      linkedPortfolioIds: ['b', 'a'],
      readinessState: 'analyzing',
      completionState: 'incomplete',
      priority: 'normal',
      routeCategory: 'review',
      slotReference: 'daily:2026-03-11'
    });

    const second = store.append({
      actionId: 'reduce-risk-exposure',
      eventType: 'action_initialized',
      reason: 'portfolio_action_projection_generated',
      linkedPortfolioIds: ['a', 'b'],
      readinessState: 'analyzing',
      completionState: 'incomplete',
      priority: 'normal',
      routeCategory: 'review',
      slotReference: 'daily:2026-03-11'
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(store.load('reduce-risk-exposure').entries[0]?.linkedPortfolioIds).toEqual(['a', 'b']);
  });

  it('T-PA-H2 keeps stable ordering', () => {
    const store = createPortfolioActionHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'portfolio-actions')
    });

    store.append({
      actionId: 'reduce-risk-exposure',
      eventType: 'action_completed',
      reason: 'action_intelligence_stabilized',
      linkedPortfolioIds: ['a'],
      readinessState: 'ready',
      completionState: 'completed',
      priority: 'normal',
      routeCategory: 'review',
      slotReference: 'daily:2026-03-12'
    });

    store.append({
      actionId: 'reduce-risk-exposure',
      eventType: 'readiness_changed',
      reason: 'action_readiness_analyzing',
      linkedPortfolioIds: ['a'],
      readinessState: 'analyzing',
      completionState: 'incomplete',
      priority: 'normal',
      routeCategory: 'review',
      slotReference: 'daily:2026-03-11'
    });

    const loaded = store.load('reduce-risk-exposure');
    expect(loaded.entries.map((entry) => entry.slotReference)).toEqual(['daily:2026-03-12', 'daily:2026-03-11']);
  });

  it('T-PA-H3 dedupe fingerprint is deterministic', () => {
    const input = {
      actionId: 'reduce-risk-exposure',
      eventType: 'action_progressed' as const,
      reason: 'action_lifecycle_progressing',
      linkedPortfolioIds: ['a'],
      readinessState: 'analyzing' as const,
      completionState: 'incomplete' as const,
      priority: 'normal' as const,
      routeCategory: 'review' as const,
      slotReference: 'daily:2026-03-11'
    };

    expect(computePortfolioActionEventDedupeKey(input)).toBe(computePortfolioActionEventDedupeKey(input));
  });

  it('T-PA-H4 appends readiness change event type', () => {
    const store = createPortfolioActionHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'portfolio-actions')
    });

    const result = store.append({
      actionId: 'reduce-risk-exposure',
      eventType: 'readiness_changed',
      reason: 'action_readiness_analyzing',
      linkedPortfolioIds: ['p1'],
      readinessState: 'analyzing',
      completionState: 'incomplete',
      priority: 'normal',
      routeCategory: 'review'
    });

    expect(result.appended).toBe(true);
    expect(result.entry.eventType).toBe('readiness_changed');
  });
});
