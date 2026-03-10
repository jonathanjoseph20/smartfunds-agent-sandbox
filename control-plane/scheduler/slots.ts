import type { MissionSchedule } from './types.ts';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDateUtc(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
}

function formatMinuteSlotUtc(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}T${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}Z`;
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

function addDaysUtc(value: Date, days: number): Date {
  const next = new Date(value.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export type ComputedSlot = {
  slotId: string;
  dueAtUtc: string;
  nextDueUtc: string;
};

export function computeScheduleSlot(schedule: MissionSchedule, tickTimeUtc: Date): ComputedSlot {
  if (schedule.cadence.type === 'daily') {
    const dayStart = startOfUtcDay(tickTimeUtc);
    const hour = schedule.cadence.hourUtc ?? 0;
    const minute = schedule.cadence.minuteUtc ?? 0;
    const dueAt = new Date(dayStart.getTime());
    dueAt.setUTCHours(hour, minute, 0, 0);

    const slotDate = formatDateUtc(dayStart);
    const nextDue = tickTimeUtc.getTime() >= dueAt.getTime()
      ? (() => {
        const next = addDaysUtc(dayStart, 1);
        next.setUTCHours(hour, minute, 0, 0);
        return next;
      })()
      : dueAt;

    return {
      slotId: `daily:${slotDate}`,
      dueAtUtc: dueAt.toISOString(),
      nextDueUtc: nextDue.toISOString()
    };
  }

  const every = schedule.cadence.every;
  const intervalMs = schedule.cadence.type === 'interval_hours'
    ? every * 60 * 60 * 1000
    : every * 60 * 1000;
  const boundaryMs = Math.floor(tickTimeUtc.getTime() / intervalMs) * intervalMs;
  const boundaryDate = new Date(boundaryMs);
  const slotStamp = formatMinuteSlotUtc(boundaryDate);
  const nextDue = new Date(boundaryMs + intervalMs);

  if (schedule.cadence.type === 'interval_hours') {
    return {
      slotId: `interval_hours:${every}:${slotStamp}`,
      dueAtUtc: boundaryDate.toISOString(),
      nextDueUtc: nextDue.toISOString()
    };
  }

  return {
    slotId: `interval_minutes:${every}:${slotStamp}`,
    dueAtUtc: boundaryDate.toISOString(),
    nextDueUtc: nextDue.toISOString()
  };
}

export function describeCadence(schedule: MissionSchedule): string {
  if (schedule.cadence.type === 'daily') {
    const hour = schedule.cadence.hourUtc ?? 0;
    const minute = schedule.cadence.minuteUtc ?? 0;
    return `daily @ ${pad2(hour)}:${pad2(minute)} UTC`;
  }
  if (schedule.cadence.type === 'interval_hours') {
    return `every ${String(schedule.cadence.every)} hour(s)`;
  }
  return `every ${String(schedule.cadence.every)} minute(s)`;
}
