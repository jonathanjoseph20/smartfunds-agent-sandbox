import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createSignalEmitter } from '../signals/signal-emitter.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-triggers-runtime');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('trigger runtime integration', () => {
  it('T-TRIG-INT1 signal emission evaluates triggers and persists trigger log', () => {
    const signalsRootDir = path.join(tmpRoot, 'signals');
    const triggersRootDir = path.join(tmpRoot, 'triggers');
    const launchRequests: Array<{ missionId: string; triggerId: string; sourceSignal: string }> = [];

    const emitter = createSignalEmitter({
      signalsRootDir,
      triggersRootDir,
      onTriggerLaunchRequests(requests) {
        launchRequests.push(...requests);
      }
    });

    const result = emitter.emitSignal('liquidity_drain', {
      dataset: 'protocol_tvl_timeseries',
      slot: 'interval_hours:6:2026-03-10T12:00Z',
      protocol: 'Aave',
      liquidityDropPercent: 12
    });

    expect(result.status).toBe('persisted');

    const triggerLog = path.join(triggersRootDir, '2026-03-10', 'trigger-log.json');
    expect(fs.existsSync(triggerLog)).toBe(true);

    const rows = JSON.parse(fs.readFileSync(triggerLog, 'utf8')) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      triggerId: 'liquidity-drain-investigation',
      signalReference: result.signal.dedupeKey,
      missionLaunched: 'defi-liquidity-scan',
      slot: 'interval_hours:6:2026-03-10T12:00Z'
    });

    expect(launchRequests).toEqual([
      {
        missionId: 'defi-liquidity-scan',
        triggerId: 'liquidity-drain-investigation',
        sourceSignal: result.signal.dedupeKey
      }
    ]);
  });
});
