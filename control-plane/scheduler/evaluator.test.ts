import { describe, expect, it } from 'vitest';

import { evaluateInvalidSchedule, evaluateSchedule } from './evaluator.ts';
import type { MissionSchedule } from './types.ts';

function hasAttemptForSlot(scheduleId: string, slotId: string): boolean {
  return scheduleId === 'launched' && slotId === 'daily:2026-03-10';
}

describe('scheduler due evaluation', () => {
  it('T-E1 marks daily schedule due at/after configured time', () => {
    const schedule: MissionSchedule = {
      scheduleId: 'daily-due',
      missionId: 'rwa-market-analysis',
      enabled: true,
      cadence: { type: 'daily', hourUtc: 13, minuteUtc: 0 }
    };

    const evaluated = evaluateSchedule({
      schedule,
      tickTimeUtc: new Date('2026-03-10T13:00:00.000Z'),
      hasAttemptForSlot: () => false
    });

    expect(evaluated.dueDecision).toBe('due');
    expect(evaluated.currentSlotId).toBe('daily:2026-03-10');
  });

  it('T-E2 marks daily schedule not_due before configured time', () => {
    const schedule: MissionSchedule = {
      scheduleId: 'daily-not-due',
      missionId: 'rwa-market-analysis',
      enabled: true,
      cadence: { type: 'daily', hourUtc: 13, minuteUtc: 0 }
    };

    const evaluated = evaluateSchedule({
      schedule,
      tickTimeUtc: new Date('2026-03-10T12:59:00.000Z'),
      hasAttemptForSlot: () => false
    });

    expect(evaluated.dueDecision).toBe('not_due');
  });

  it('T-E3 marks interval schedule due', () => {
    const schedule: MissionSchedule = {
      scheduleId: 'interval-due',
      missionId: 'defi-yield-report',
      enabled: true,
      cadence: { type: 'interval_hours', every: 6 }
    };

    const evaluated = evaluateSchedule({
      schedule,
      tickTimeUtc: new Date('2026-03-10T12:30:00.000Z'),
      hasAttemptForSlot: () => false
    });

    expect(evaluated.dueDecision).toBe('due');
  });

  it('T-E4 marks disabled schedules as disabled', () => {
    const schedule: MissionSchedule = {
      scheduleId: 'disabled',
      missionId: 'defi-yield-report',
      enabled: false,
      cadence: { type: 'interval_hours', every: 6 }
    };

    const evaluated = evaluateSchedule({
      schedule,
      tickTimeUtc: new Date('2026-03-10T12:30:00.000Z'),
      hasAttemptForSlot: () => false
    });

    expect(evaluated.dueDecision).toBe('disabled');
  });

  it('T-E5 marks already attempted slots as already_launched_for_slot', () => {
    const schedule: MissionSchedule = {
      scheduleId: 'launched',
      missionId: 'rwa-market-analysis',
      enabled: true,
      cadence: { type: 'daily', hourUtc: 13, minuteUtc: 0 }
    };

    const evaluated = evaluateSchedule({
      schedule,
      tickTimeUtc: new Date('2026-03-10T13:10:00.000Z'),
      hasAttemptForSlot
    });

    expect(evaluated.dueDecision).toBe('already_launched_for_slot');
  });

  it('T-E6 classifies invalid schedules as invalid_schedule', () => {
    const evaluated = evaluateInvalidSchedule({
      scheduleId: 'invalid',
      errors: ['unsupported cadence.type: cron'],
      raw: { cadence: { type: 'cron' } }
    });

    expect(evaluated.dueDecision).toBe('invalid_schedule');
    expect(evaluated.reason).toContain('unsupported cadence.type: cron');
  });
});
