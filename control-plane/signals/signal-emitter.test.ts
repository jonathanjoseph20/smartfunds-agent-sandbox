import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { computeSignalDedupeKey } from './signal-deduper.ts';
import { createSignalEmitter } from './signal-emitter.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-signals-emitter');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('signal emitter', () => {
  it('T-SIG-E1 emits deterministic signal record and persists canonical JSON', () => {
    const signalsRootDir = path.join(tmpRoot, 'signals');
    const emitter = createSignalEmitter({ signalsRootDir });

    const result = emitter.emitSignal('tvl_spike', {
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      tvlChangePercent: 12,
      artifactReference: 'artifacts/defi-liquidity-scan/run_1/liquidity-snapshot-json.json'
    });

    expect(result.status).toBe('persisted');
    expect(result.signal.dedupeKey).toBe(computeSignalDedupeKey({
      signalType: 'tvl_spike',
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z'
    }));

    const logPath = path.join(signalsRootDir, '2026-03-10', 'signal-log.json');
    const raw = fs.readFileSync(logPath, 'utf8');
    const parsed = JSON.parse(raw) as unknown[];
    expect(raw).toBe(`${canonicalStringify(parsed)}\n`);
    expect(parsed).toHaveLength(1);
  });

  it('T-SIG-E2 duplicate emission is idempotent with no second append', () => {
    const signalsRootDir = path.join(tmpRoot, 'signals');
    const emitter = createSignalEmitter({ signalsRootDir });

    const payload = {
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      tvlChangePercent: 12
    };

    const first = emitter.emitSignal('tvl_spike', payload);
    const second = emitter.emitSignal('tvl_spike', payload);

    expect(first.status).toBe('persisted');
    expect(second.status).toBe('duplicate');

    const logPath = path.join(signalsRootDir, '2026-03-10', 'signal-log.json');
    const entries = JSON.parse(fs.readFileSync(logPath, 'utf8')) as unknown[];
    expect(entries).toHaveLength(1);
  });

  it('T-SIG-E3 rejects payload without deterministic slot/reportDate date', () => {
    const signalsRootDir = path.join(tmpRoot, 'signals');
    const emitter = createSignalEmitter({ signalsRootDir });

    expect(() => emitter.emitSignal('tvl_spike', {
      dataset: 'protocol_tvl_timeseries',
      slot: 'slot-without-date',
      protocol: 'Aave',
      tvlChangePercent: 12
    })).toThrow('Signal requires deterministic reportDate or slot with YYYY-MM-DD.');
  });

  it('T-SIG-E4 dedupe key is stable regardless of incidental metadata', () => {
    const keyA = computeSignalDedupeKey({
      signalType: 'tvl_spike',
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z'
    });
    const keyB = computeSignalDedupeKey({
      signalType: 'tvl_spike',
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z'
    });

    expect(keyA).toBe(keyB);
  });
});
