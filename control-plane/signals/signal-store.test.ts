import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalStore } from './signal-store.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-signals-store');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('signal store', () => {
  it('T-SIG-S1 provides stable deterministic ordering for inspection reads', () => {
    const store = createSignalStore({ rootDir: path.join(tmpRoot, 'signals') });

    store.appendSignal({
      signalType: 'yield_anomaly',
      sourceMission: 'yield-scan',
      dataset: 'yield_rate_history',
      metadata: { protocol: 'Aave', yieldChangePercent: 7 },
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      dedupeKey: 'k2',
      logDate: '2026-03-10'
    });

    store.appendSignal({
      signalType: 'governance_proposal',
      sourceMission: 'governance-scan',
      dataset: 'governance_vote_tracker',
      metadata: { protocol: 'Uniswap', proposalId: '77' },
      slot: 'interval_hours:6:2026-03-11T12:00Z',
      dedupeKey: 'k1',
      logDate: '2026-03-11'
    });

    const listed = store.listSignals();
    expect(listed.map((entry) => `${entry.logDate}:${entry.signalType}`)).toEqual([
      '2026-03-11:governance_proposal',
      '2026-03-10:yield_anomaly'
    ]);

    const history = store.listHistory();
    expect(history.map((entry) => entry.date)).toEqual(['2026-03-11', '2026-03-10']);
  });
});
