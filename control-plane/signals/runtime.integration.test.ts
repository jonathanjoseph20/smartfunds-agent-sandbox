import fs from 'node:fs';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createResearchRuntime } from '../research/runtime.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-signals-runtime');
const artifactsRoot = path.join(tmpRoot, 'artifacts');
const teamsDir = path.join(tmpRoot, 'teams');
const packsDir = path.join(tmpRoot, 'packs');
const scheduleRegistryPath = path.join(tmpRoot, 'scheduler-registry.json');

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

beforeEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(tmpRoot, { recursive: true });

  writeJson(path.join(teamsDir, 'defi-intelligence.json'), {
    teamId: 'defi-intelligence',
    missionPackId: 'defi-intelligence',
    description: 'team',
    enabled: true
  });

  writeJson(path.join(packsDir, 'defi-intelligence.json'), {
    packId: 'defi-intelligence',
    teamId: 'defi-intelligence',
    schedules: ['defi-liquidity-hourly-scan']
  });

  writeJson(scheduleRegistryPath, {
    schemaVersion: 1,
    schedules: [
      { scheduleId: 'defi-liquidity-hourly-scan', missionId: 'defi-liquidity-scan', enabled: true, cadence: { type: 'interval_hours', every: 6 } }
    ]
  });
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('signal runtime integration', () => {
  it('T-SIG-INT1 dataset accumulation emits and persists deterministic signal', () => {
    writeJson(path.join(artifactsRoot, 'defi-liquidity-scan', 'run_1', 'liquidity-snapshot-json.json'), {
      entries: [{ protocol: 'Aave', tvlChangePercent: 12 }]
    });

    const runtime = createResearchRuntime({
      artifactsRoot,
      teamsDir,
      packsDir,
      scheduleRegistryPath
    });

    const launch = {
      scheduleId: 'defi-liquidity-hourly-scan',
      missionId: 'defi-liquidity-scan',
      slotId: 'interval_hours:6:2026-03-10T12:00Z',
      dueDecision: 'due' as const,
      launched: true,
      runId: 'run_1',
      attemptedAtUtc: '2026-03-10T12:01:00.000Z'
    };

    const first = runtime.processLaunch(launch);
    const second = runtime.processLaunch(launch);

    expect(first[0].processed).toBe(true);
    expect(second[0].processed).toBe(false);

    const signalLogPath = path.join(tmpRoot, 'signals', '2026-03-10', 'signal-log.json');
    expect(fs.existsSync(signalLogPath)).toBe(true);

    const rows = JSON.parse(fs.readFileSync(signalLogPath, 'utf8')) as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(1);
    expect(rows[0].signalType).toBe('tvl_spike');
    expect(rows[0].dataset).toBe('protocol_tvl_timeseries');
  });
});
