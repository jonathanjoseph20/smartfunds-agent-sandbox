import { evaluateInvalidSchedule, evaluateSchedule } from './evaluator.ts';
import type { ScheduleLaunchJournal } from './journal.ts';
import type { ScheduleRegistry } from './types.ts';
import type { ScheduleEvaluation, ScheduleInspection, ScheduleLaunchRecord } from './types.ts';

function latestRecord(records: ScheduleLaunchRecord[]): ScheduleLaunchRecord | undefined {
  return [...records].sort((left, right) => {
    const slotCmp = right.slotId.localeCompare(left.slotId);
    if (slotCmp !== 0) {
      return slotCmp;
    }
    return right.attemptedAtUtc.localeCompare(left.attemptedAtUtc);
  })[0];
}

function latestRecordWithRun(records: ScheduleLaunchRecord[]): ScheduleLaunchRecord | undefined {
  return historyDescending(records).find((record) => typeof record.runId === 'string');
}

function historyDescending(records: ScheduleLaunchRecord[]): ScheduleLaunchRecord[] {
  return [...records].sort((left, right) => {
    const slotCmp = right.slotId.localeCompare(left.slotId);
    if (slotCmp !== 0) {
      return slotCmp;
    }
    return right.attemptedAtUtc.localeCompare(left.attemptedAtUtc);
  });
}

export function buildScheduleInspections(input: {
  registry: ScheduleRegistry;
  journal: ScheduleLaunchJournal;
  tickTimeUtc: Date;
  historyLimit?: number;
}): ScheduleInspection[] {
  const historyLimit = input.historyLimit ?? 20;

  const validInspections = input.registry.schedules.map((schedule) => {
    const evaluation = evaluateSchedule({
      schedule,
      tickTimeUtc: input.tickTimeUtc,
      hasAttemptForSlot: input.journal.hasAttemptForSlot
    });

    const launchHistory = historyDescending(input.journal.listLaunchRecords(schedule.scheduleId)).slice(0, historyLimit);
    const latest = latestRecord(launchHistory);
    const latestWithRun = latestRecordWithRun(launchHistory);

    return {
      scheduleId: schedule.scheduleId,
      missionId: schedule.missionId,
      enabled: schedule.enabled,
      cadenceDescription: evaluation.cadenceDescription,
      currentDueDecision: evaluation.dueDecision,
      ...(evaluation.currentSlotId ? { currentSlotId: evaluation.currentSlotId } : {}),
      ...(evaluation.dueAtUtc ? { dueAtUtc: evaluation.dueAtUtc } : {}),
      ...(evaluation.nextDueUtc ? { nextDueUtc: evaluation.nextDueUtc } : {}),
      ...(latest ? { lastLaunchSlotId: latest.slotId } : {}),
      ...(latestWithRun?.runId ? { lastRunId: latestWithRun.runId } : {}),
      ...(latest?.launchError ? { lastLaunchError: latest.launchError } : {}),
      launchHistory
    };
  });

  const invalidInspections = input.registry.invalidSchedules.map((invalid) => {
    const evaluation = evaluateInvalidSchedule(invalid);
    const launchHistory: ScheduleLaunchRecord[] = historyDescending(input.journal.listLaunchRecords(invalid.scheduleId)).slice(0, historyLimit);
    const latest = latestRecord(launchHistory);
    const latestWithRun = latestRecordWithRun(launchHistory);

    return {
      scheduleId: invalid.scheduleId,
      missionId: invalid.missionId ?? null,
      enabled: invalid.enabled ?? false,
      cadenceDescription: evaluation.cadenceDescription,
      currentDueDecision: evaluation.dueDecision,
      ...(latest ? { lastLaunchSlotId: latest.slotId } : {}),
      ...(latestWithRun?.runId ? { lastRunId: latestWithRun.runId } : {}),
      ...(latest?.launchError ? { lastLaunchError: latest.launchError } : {}),
      launchHistory
    };
  });

  return [...validInspections, ...invalidInspections]
    .sort((left, right) => left.scheduleId.localeCompare(right.scheduleId));
}

export function evaluateAllSchedules(input: {
  registry: ScheduleRegistry;
  journal: ScheduleLaunchJournal;
  tickTimeUtc: Date;
}): ScheduleEvaluation[] {
  const valid = input.registry.schedules.map((schedule) => evaluateSchedule({
    schedule,
    tickTimeUtc: input.tickTimeUtc,
    hasAttemptForSlot: input.journal.hasAttemptForSlot
  }));

  const invalid = input.registry.invalidSchedules.map((schedule) => evaluateInvalidSchedule(schedule));

  return [...valid, ...invalid].sort((left, right) => left.scheduleId.localeCompare(right.scheduleId));
}
