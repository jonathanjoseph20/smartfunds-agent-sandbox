import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { loadScheduleRegistry } from './registry.ts';

const tmpDir = path.join('control-plane', '__tests__', 'tmp-scheduler-registry');

function writeRegistry(value: unknown): string {
  fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, 'registry.json');
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  return filePath;
}

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('scheduler registry', () => {
  it('T-M1 loads valid daily and interval schedules', () => {
    const filePath = writeRegistry({
      schemaVersion: 1,
      schedules: [
        {
          scheduleId: 'daily-brief',
          missionId: 'rwa-market-analysis',
          enabled: true,
          cadence: { type: 'daily', hourUtc: 13, minuteUtc: 15 }
        },
        {
          scheduleId: 'hourly-scan',
          missionId: 'defi-yield-report',
          enabled: true,
          cadence: { type: 'interval_hours', every: 6 }
        }
      ]
    });

    const loaded = loadScheduleRegistry(filePath);
    expect(loaded.schedules.map((entry) => entry.scheduleId)).toEqual(['daily-brief', 'hourly-scan']);
    expect(loaded.invalidSchedules).toEqual([]);
  });

  it('T-M2 classifies invalid cadence config deterministically', () => {
    const filePath = writeRegistry({
      schemaVersion: 1,
      schedules: [
        {
          scheduleId: 'broken',
          missionId: 'rwa-market-analysis',
          enabled: true,
          cadence: { type: 'interval_hours', every: 0 }
        }
      ]
    });

    const loaded = loadScheduleRegistry(filePath);
    expect(loaded.schedules).toEqual([]);
    expect(loaded.invalidSchedules).toEqual([
      expect.objectContaining({
        scheduleId: 'broken',
        errors: ['interval_hours cadence every must be a positive integer']
      })
    ]);
  });

  it('T-M3 enforces stable ordering of definitions', () => {
    const filePath = writeRegistry({
      schemaVersion: 1,
      schedules: [
        {
          scheduleId: 'zeta',
          missionId: 'rwa-market-analysis',
          enabled: true,
          cadence: { type: 'daily' }
        },
        {
          scheduleId: 'alpha',
          missionId: 'defi-yield-report',
          enabled: true,
          cadence: { type: 'interval_hours', every: 6 }
        }
      ]
    });

    const loaded = loadScheduleRegistry(filePath);
    expect(loaded.schedules.map((entry) => entry.scheduleId)).toEqual(['alpha', 'zeta']);
  });
});
