import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTriggerEngine } from './trigger-engine.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-triggers-engine');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('trigger engine', () => {
  it('T-TRIG-E1 returns no_match when signalType has no trigger', () => {
    const defsDir = path.join(tmpRoot, 'definitions');
    writeJson(path.join(defsDir, 'one.json'), {
      triggerId: 'one',
      signalType: 'tvl_spike',
      mission: 'defi-liquidity-scan',
      cooldownSlots: 1
    });

    const engine = createTriggerEngine({
      definitionsDir: defsDir,
      triggersRootDir: path.join(tmpRoot, 'triggers')
    });

    const result = engine.evaluateSignalForTriggers({
      signalType: 'yield_anomaly',
      sourceMission: 'yield-scan',
      dataset: 'yield_rate_history',
      metadata: { protocol: 'Aave' },
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      dedupeKey: 'signal-key-1',
      logDate: '2026-03-10'
    });

    expect(result).toEqual({
      status: 'no_match',
      launchRequests: []
    });
  });

  it('T-TRIG-E2 creates deterministic mission launch requests and persists records', () => {
    const defsDir = path.join(tmpRoot, 'definitions');
    writeJson(path.join(defsDir, 'b.json'), {
      triggerId: 'b-trigger',
      signalType: 'tvl_spike',
      mission: 'research-market-scan',
      cooldownSlots: 1
    });
    writeJson(path.join(defsDir, 'a.json'), {
      triggerId: 'a-trigger',
      signalType: 'tvl_spike',
      mission: 'defi-liquidity-scan',
      cooldownSlots: 1
    });

    const triggersRootDir = path.join(tmpRoot, 'triggers');
    const engine = createTriggerEngine({ definitionsDir: defsDir, triggersRootDir });

    const result = engine.evaluateSignalForTriggers({
      signalType: 'tvl_spike',
      sourceMission: 'liquidity-scan',
      dataset: 'protocol_tvl_timeseries',
      metadata: { protocol: 'Aave', tvlChangePercent: 12 },
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      dedupeKey: 'signal-key-1',
      logDate: '2026-03-10'
    });

    expect(result).toEqual({
      status: 'triggered',
      launchRequests: [
        {
          missionId: 'defi-liquidity-scan',
          triggerId: 'a-trigger',
          sourceSignal: 'signal-key-1'
        },
        {
          missionId: 'research-market-scan',
          triggerId: 'b-trigger',
          sourceSignal: 'signal-key-1'
        }
      ]
    });

    const rows = JSON.parse(fs.readFileSync(path.join(triggersRootDir, '2026-03-10', 'trigger-log.json'), 'utf8')) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.triggerId)).toEqual(['a-trigger', 'b-trigger']);
  });

  it('T-TRIG-E3 deduplicates same trigger + signalReference + slot', () => {
    const defsDir = path.join(tmpRoot, 'definitions');
    writeJson(path.join(defsDir, 'one.json'), {
      triggerId: 'only-trigger',
      signalType: 'tvl_spike',
      mission: 'defi-liquidity-scan',
      cooldownSlots: 1
    });

    const engine = createTriggerEngine({
      definitionsDir: defsDir,
      triggersRootDir: path.join(tmpRoot, 'triggers')
    });

    const signal = {
      signalType: 'tvl_spike',
      sourceMission: 'liquidity-scan',
      dataset: 'protocol_tvl_timeseries',
      metadata: { protocol: 'Aave', tvlChangePercent: 12 },
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      dedupeKey: 'signal-key-1',
      logDate: '2026-03-10'
    } as const;

    const first = engine.evaluateSignalForTriggers(signal);
    const second = engine.evaluateSignalForTriggers(signal);

    expect(first.status).toBe('triggered');
    expect(second).toEqual({
      status: 'duplicate',
      launchRequests: []
    });
  });
});
