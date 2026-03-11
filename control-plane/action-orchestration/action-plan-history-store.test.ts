import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  computeActionPlanEventDedupeKey,
  createActionPlanHistoryStore,
} from './action-plan-history-store.ts';

const tmpRoot = path.join('control-plane', 'tests', 'tmp-action-plan-history');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('action-orchestration history store', () => {
  it('T-AO-H1 appends deterministic events and dedupes by fingerprint', () => {
    const store = createActionPlanHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'action-orchestration'),
    });

    const first = store.append({
      actionPlanId: 'risk-reduction-plan',
      eventType: 'action_plan_initialized',
      reason: 'action_plan_projection_generated',
      linkedActionIds: ['a2', 'a1'],
      slotReference: 'daily:2026-03-11',
    });

    const second = store.append({
      actionPlanId: 'risk-reduction-plan',
      eventType: 'action_plan_initialized',
      reason: 'action_plan_projection_generated',
      linkedActionIds: ['a1', 'a2'],
      slotReference: 'daily:2026-03-11',
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);
    expect(store.load('risk-reduction-plan').entries[0]?.linkedActionIds).toEqual(['a1', 'a2']);
  });

  it('T-AO-H2 keeps stable ordering', () => {
    const store = createActionPlanHistoryStore({
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'action-orchestration'),
    });

    store.append({
      actionPlanId: 'risk-reduction-plan',
      eventType: 'plan_completed',
      reason: 'action_plan_intelligence_stabilized',
      linkedActionIds: ['a1'],
      slotReference: 'daily:2026-03-12',
    });

    store.append({
      actionPlanId: 'risk-reduction-plan',
      eventType: 'readiness_changed',
      reason: 'action_plan_readiness_analyzing',
      linkedActionIds: ['a1'],
      slotReference: 'daily:2026-03-11',
    });

    const loaded = store.load('risk-reduction-plan');
    expect(loaded.entries.map((entry) => entry.slotReference)).toEqual(['daily:2026-03-12', 'daily:2026-03-11']);
  });

  it('T-AO-H3 dedupe fingerprint is deterministic', () => {
    const input = {
      actionPlanId: 'risk-reduction-plan',
      eventType: 'plan_progressed' as const,
      reason: 'action_plan_lifecycle_progressing',
      linkedActionIds: ['a1'],
      slotReference: 'daily:2026-03-11',
    };

    expect(computeActionPlanEventDedupeKey(input)).toBe(computeActionPlanEventDedupeKey(input));
  });
});
