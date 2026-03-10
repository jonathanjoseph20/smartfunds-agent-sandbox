import { describe, expect, it } from 'vitest';

import { computeScheduleSlot } from './slots.ts';
import type { MissionSchedule } from './types.ts';

function dailySchedule(): MissionSchedule {
  return {
    scheduleId: 'daily',
    missionId: 'rwa-market-analysis',
    enabled: true,
    cadence: { type: 'daily', hourUtc: 13, minuteUtc: 0 }
  };
}

function intervalSchedule(): MissionSchedule {
  return {
    scheduleId: 'interval',
    missionId: 'defi-yield-report',
    enabled: true,
    cadence: { type: 'interval_hours', every: 6 }
  };
}

describe('scheduler slot computation', () => {
  it('T-S1 daily slot identity is stable within day', () => {
    const schedule = dailySchedule();

    const left = computeScheduleSlot(schedule, new Date('2026-03-10T13:05:00.000Z'));
    const right = computeScheduleSlot(schedule, new Date('2026-03-10T20:59:00.000Z'));

    expect(left.slotId).toBe('daily:2026-03-10');
    expect(right.slotId).toBe('daily:2026-03-10');
  });

  it('T-S2 interval slot identity is stable within boundary', () => {
    const schedule = intervalSchedule();

    const left = computeScheduleSlot(schedule, new Date('2026-03-10T12:01:00.000Z'));
    const right = computeScheduleSlot(schedule, new Date('2026-03-10T17:59:59.000Z'));

    expect(left.slotId).toBe('interval_hours:6:2026-03-10T12:00Z');
    expect(right.slotId).toBe('interval_hours:6:2026-03-10T12:00Z');
  });

  it('T-S3 same tick yields same slot', () => {
    const schedule = intervalSchedule();
    const tick = new Date('2026-03-10T12:30:00.000Z');

    expect(computeScheduleSlot(schedule, tick)).toEqual(computeScheduleSlot(schedule, tick));
  });

  it('T-S4 adjacent interval slots produce different ids', () => {
    const schedule = intervalSchedule();

    const left = computeScheduleSlot(schedule, new Date('2026-03-10T11:59:59.000Z'));
    const right = computeScheduleSlot(schedule, new Date('2026-03-10T12:00:00.000Z'));

    expect(left.slotId).toBe('interval_hours:6:2026-03-10T06:00Z');
    expect(right.slotId).toBe('interval_hours:6:2026-03-10T12:00Z');
  });
});
