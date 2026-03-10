import { computeScheduleSlot, describeCadence } from './slots.ts';
import type { InvalidMissionSchedule, MissionSchedule, ScheduleEvaluation } from './types.ts';

export function evaluateInvalidSchedule(invalid: InvalidMissionSchedule): ScheduleEvaluation {
  return {
    scheduleId: invalid.scheduleId,
    missionId: invalid.missionId ?? null,
    enabled: invalid.enabled ?? false,
    dueDecision: 'invalid_schedule',
    cadenceDescription: 'invalid',
    reason: invalid.errors.join('; ')
  };
}

export function evaluateSchedule(input: {
  schedule: MissionSchedule;
  tickTimeUtc: Date;
  hasAttemptForSlot: (scheduleId: string, slotId: string) => boolean;
}): ScheduleEvaluation {
  const { schedule, tickTimeUtc } = input;
  const slot = computeScheduleSlot(schedule, tickTimeUtc);

  if (!schedule.enabled) {
    return {
      scheduleId: schedule.scheduleId,
      missionId: schedule.missionId,
      enabled: false,
      dueDecision: 'disabled',
      cadenceDescription: describeCadence(schedule),
      currentSlotId: slot.slotId,
      dueAtUtc: slot.dueAtUtc,
      nextDueUtc: slot.nextDueUtc,
      reason: 'schedule disabled'
    };
  }

  const attempted = input.hasAttemptForSlot(schedule.scheduleId, slot.slotId);
  if (attempted) {
    return {
      scheduleId: schedule.scheduleId,
      missionId: schedule.missionId,
      enabled: true,
      dueDecision: 'already_launched_for_slot',
      cadenceDescription: describeCadence(schedule),
      currentSlotId: slot.slotId,
      dueAtUtc: slot.dueAtUtc,
      nextDueUtc: slot.nextDueUtc,
      reason: 'slot already attempted'
    };
  }

  if (schedule.cadence.type === 'daily') {
    const dueAtMs = Date.parse(slot.dueAtUtc);
    if (tickTimeUtc.getTime() < dueAtMs) {
      return {
        scheduleId: schedule.scheduleId,
        missionId: schedule.missionId,
        enabled: true,
        dueDecision: 'not_due',
        cadenceDescription: describeCadence(schedule),
        currentSlotId: slot.slotId,
        dueAtUtc: slot.dueAtUtc,
        nextDueUtc: slot.nextDueUtc,
        reason: 'daily schedule not yet due'
      };
    }
  }

  return {
    scheduleId: schedule.scheduleId,
    missionId: schedule.missionId,
    enabled: true,
    dueDecision: 'due',
    cadenceDescription: describeCadence(schedule),
    currentSlotId: slot.slotId,
    dueAtUtc: slot.dueAtUtc,
    nextDueUtc: slot.nextDueUtc
  };
}
