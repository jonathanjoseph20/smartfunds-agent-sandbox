import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { createTriggerStore } from './trigger-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-triggers-store');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('trigger store', () => {
  it('T-TRIG-S1 appends once for unique dedupe identity and writes canonical JSON', () => {
    const store = createTriggerStore({ rootDir: path.join(tmpRoot, 'triggers') });

    const first = store.appendTrigger({
      logDate: '2026-03-10',
      record: {
        triggerId: 'liquidity-drain-investigation',
        signalReference: 'sig-1',
        missionLaunched: 'defi-liquidity-scan',
        slot: 'interval_hours:6:2026-03-10T12:00Z'
      }
    });

    const second = store.appendTrigger({
      logDate: '2026-03-10',
      record: {
        triggerId: 'liquidity-drain-investigation',
        signalReference: 'sig-1',
        missionLaunched: 'defi-liquidity-scan',
        slot: 'interval_hours:6:2026-03-10T12:00Z'
      }
    });

    expect(first.appended).toBe(true);
    expect(second.appended).toBe(false);

    const raw = fs.readFileSync(first.path, 'utf8');
    const parsed = JSON.parse(raw) as unknown[];
    expect(raw).toBe(`${canonicalStringify(parsed)}\n`);
    expect(parsed).toHaveLength(1);
  });

  it('T-TRIG-S2 provides deterministic history ordering', () => {
    const store = createTriggerStore({ rootDir: path.join(tmpRoot, 'triggers') });

    store.appendTrigger({
      logDate: '2026-03-10',
      record: {
        triggerId: 'yield-anomaly-investigation',
        signalReference: 'sig-2',
        missionLaunched: 'defi-yield-report',
        slot: 'interval_hours:6:2026-03-10T06:00Z'
      }
    });
    store.appendTrigger({
      logDate: '2026-03-11',
      record: {
        triggerId: 'governance-proposal-investigation',
        signalReference: 'sig-1',
        missionLaunched: 'defi-governance-events',
        slot: 'interval_hours:6:2026-03-11T06:00Z'
      }
    });

    const history = store.listHistory();
    expect(history.map((entry) => entry.date)).toEqual(['2026-03-11', '2026-03-10']);

    const listed = store.listTriggers();
    expect(listed.map((entry) => entry.triggerId)).toEqual([
      'governance-proposal-investigation',
      'yield-anomaly-investigation'
    ]);
  });
});
