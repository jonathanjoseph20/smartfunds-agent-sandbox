import type { ProgramExecutionHistoryEntry } from './program-types.ts';
import type { CohortProgramDefinition, ProgramCadenceEvaluation } from './program-types.ts';

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatMinuteSlotUtc(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}T${pad2(value.getUTCHours())}:${pad2(value.getUTCMinutes())}Z`;
}

function formatDateUtc(value: Date): string {
  return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(value.getUTCDate())}`;
}

function startOfUtcHour(value: Date): Date {
  return new Date(Date.UTC(
    value.getUTCFullYear(),
    value.getUTCMonth(),
    value.getUTCDate(),
    value.getUTCHours(),
    0,
    0,
    0
  ));
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate(), 0, 0, 0, 0));
}

function startOfUtcIsoWeek(value: Date): Date {
  const date = startOfUtcDay(value);
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date;
}

function cadenceSlot(cadence: CohortProgramDefinition['cadence'], now: Date): string {
  if (cadence === 'hourly') {
    return `interval_hours:1:${formatMinuteSlotUtc(startOfUtcHour(now))}`;
  }
  if (cadence === 'daily') {
    return `daily:${formatDateUtc(startOfUtcDay(now))}`;
  }
  if (cadence === 'weekly') {
    return `weekly:${formatDateUtc(startOfUtcIsoWeek(now))}`;
  }
  return `signal:${formatDateUtc(startOfUtcDay(now))}`;
}

function hasExecutionForSlot(entries: ProgramExecutionHistoryEntry[], slot: string): boolean {
  return entries.some((entry) => entry.evaluatedSlot === slot);
}

export function evaluateProgramCadence(input: {
  program: CohortProgramDefinition;
  now: Date;
  historyEntries: ProgramExecutionHistoryEntry[];
  explicitSlot?: string;
}): ProgramCadenceEvaluation {
  const currentSlot = input.explicitSlot ?? cadenceSlot(input.program.cadence, input.now);

  if (input.program.cadence === 'signal_driven') {
    return {
      cadence: input.program.cadence,
      currentSlot,
      cadenceDue: false,
      cadenceReason: 'signal_driven_cadence'
    };
  }

  if (hasExecutionForSlot(input.historyEntries, currentSlot)) {
    return {
      cadence: input.program.cadence,
      currentSlot,
      cadenceDue: false,
      cadenceReason: 'already_executed_for_slot'
    };
  }

  return {
    cadence: input.program.cadence,
    currentSlot,
    cadenceDue: true,
    cadenceReason: 'cadence_due'
  };
}

export function programCadenceLaunchSlot(input: {
  cadence: CohortProgramDefinition['cadence'];
  cadenceSlot: string;
}): string {
  if (input.cadence !== 'weekly') {
    return input.cadenceSlot;
  }

  const weeklyMatch = /^weekly:(\d{4}-\d{2}-\d{2})$/.exec(input.cadenceSlot);
  if (!weeklyMatch?.[1]) {
    return input.cadenceSlot;
  }

  return `daily:${weeklyMatch[1]}`;
}
