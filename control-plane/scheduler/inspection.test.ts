import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildScheduleInspections } from './inspection.ts';
import { createScheduleLaunchJournal } from './journal.ts';
import type { ScheduleRegistry } from './types.ts';

const tmpDir = path.join('control-plane', '__tests__', 'tmp-scheduler-inspection');

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('scheduler inspection', () => {
  it('T-I1 inspection output and history ordering are stable', () => {
    const journal = createScheduleLaunchJournal({ rootDir: tmpDir });

    journal.appendAttempt({
      scheduleId: 'alpha',
      missionId: 'rwa-market-analysis',
      slotId: 'daily:2026-03-10',
      recordedAtUtc: '2026-03-10T13:00:00.000Z'
    });
    journal.appendSuccess({
      scheduleId: 'alpha',
      missionId: 'rwa-market-analysis',
      slotId: 'daily:2026-03-10',
      runId: 'run_smartfunds-core_0001',
      recordedAtUtc: '2026-03-10T13:00:01.000Z'
    });

    journal.appendAttempt({
      scheduleId: 'alpha',
      missionId: 'rwa-market-analysis',
      slotId: 'daily:2026-03-11',
      recordedAtUtc: '2026-03-11T13:00:00.000Z'
    });
    journal.appendFailure({
      scheduleId: 'alpha',
      missionId: 'rwa-market-analysis',
      slotId: 'daily:2026-03-11',
      launchError: 'MISSION_REJECTED: bad params',
      recordedAtUtc: '2026-03-11T13:00:01.000Z'
    });

    const registry: ScheduleRegistry = {
      schemaVersion: 1,
      schedules: [{
        scheduleId: 'alpha',
        missionId: 'rwa-market-analysis',
        enabled: true,
        cadence: { type: 'daily', hourUtc: 13, minuteUtc: 0 }
      }],
      invalidSchedules: []
    };

    const inspections = buildScheduleInspections({
      registry,
      journal,
      tickTimeUtc: new Date('2026-03-11T14:00:00.000Z')
    });

    expect(inspections).toHaveLength(1);
    expect(inspections[0].scheduleId).toBe('alpha');
    expect(inspections[0].lastRunId).toBe('run_smartfunds-core_0001');
    expect(inspections[0].lastLaunchError).toBe('MISSION_REJECTED: bad params');
    expect(inspections[0].launchHistory.map((entry) => entry.slotId)).toEqual([
      'daily:2026-03-11',
      'daily:2026-03-10'
    ]);
  });
});
