import fs from 'node:fs';
import path from 'node:path';

import type {
  InvalidMissionSchedule,
  MissionSchedule,
  MissionScheduleCadence,
  ScheduleRegistry
} from './types.ts';

export const DEFAULT_SCHEDULE_REGISTRY_PATH = 'control-plane/scheduler/registry.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isStringMap(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === 'string');
}

function normalizeCadence(value: unknown): { cadence?: MissionScheduleCadence; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) {
    errors.push('cadence must be an object');
    return { errors };
  }

  const type = asTrimmedString(value.type);
  if (!type) {
    errors.push('cadence.type must be a non-empty string');
    return { errors };
  }

  if (type === 'daily') {
    const hour = value.hourUtc;
    const minute = value.minuteUtc;
    const hourUtc = hour === undefined ? 0 : hour;
    const minuteUtc = minute === undefined ? 0 : minute;

    if (!Number.isInteger(hourUtc) || hourUtc < 0 || hourUtc > 23) {
      errors.push('daily cadence hourUtc must be an integer between 0 and 23');
    }
    if (!Number.isInteger(minuteUtc) || minuteUtc < 0 || minuteUtc > 59) {
      errors.push('daily cadence minuteUtc must be an integer between 0 and 59');
    }

    if (errors.length > 0) {
      return { errors };
    }

    return {
      cadence: {
        type: 'daily',
        hourUtc,
        minuteUtc
      },
      errors
    };
  }

  if (type === 'interval_hours' || type === 'interval_minutes') {
    const every = value.every;
    if (!Number.isInteger(every) || (every as number) <= 0) {
      errors.push(`${type} cadence every must be a positive integer`);
      return { errors };
    }

    if (type === 'interval_hours') {
      return {
        cadence: {
          type: 'interval_hours',
          every
        },
        errors
      };
    }

    return {
      cadence: {
        type: 'interval_minutes',
        every
      },
      errors
    };
  }

  errors.push(`unsupported cadence.type: ${type}`);
  return { errors };
}

function normalizeSchedule(
  raw: unknown,
  index: number,
  seenScheduleIds: Set<string>
): { valid?: MissionSchedule; invalid?: InvalidMissionSchedule } {
  const errors: string[] = [];
  if (!isRecord(raw)) {
    return {
      invalid: {
        scheduleId: `invalid_schedule_${String(index + 1).padStart(4, '0')}`,
        errors: ['schedule must be an object'],
        raw
      }
    };
  }

  const scheduleId = asTrimmedString(raw.scheduleId) ?? `invalid_schedule_${String(index + 1).padStart(4, '0')}`;
  const missionId = asTrimmedString(raw.missionId);
  const enabledRaw = raw.enabled;

  if (!asTrimmedString(raw.scheduleId)) {
    errors.push('scheduleId must be a non-empty string');
  }
  if (seenScheduleIds.has(scheduleId)) {
    errors.push(`duplicate scheduleId: ${scheduleId}`);
  }
  if (!missionId) {
    errors.push('missionId must be a non-empty string');
  }
  if (typeof enabledRaw !== 'boolean') {
    errors.push('enabled must be a boolean');
  }

  const cadenceNormalized = normalizeCadence(raw.cadence);
  errors.push(...cadenceNormalized.errors);

  if (raw.params !== undefined && !isStringMap(raw.params)) {
    errors.push('params must be an object of string values');
  }

  if (raw.maxLaunchesPerSlot !== undefined && raw.maxLaunchesPerSlot !== 1) {
    errors.push('maxLaunchesPerSlot must be 1 when provided');
  }

  if (errors.length > 0 || !missionId || !cadenceNormalized.cadence || typeof enabledRaw !== 'boolean') {
    seenScheduleIds.add(scheduleId);
    return {
      invalid: {
        scheduleId,
        missionId: missionId ?? undefined,
        enabled: typeof enabledRaw === 'boolean' ? enabledRaw : undefined,
        errors: [...errors].sort((left, right) => left.localeCompare(right)),
        raw
      }
    };
  }

  const normalized: MissionSchedule = {
    scheduleId,
    missionId,
    enabled: enabledRaw,
    cadence: cadenceNormalized.cadence,
    ...(raw.params && isStringMap(raw.params)
      ? { params: Object.fromEntries(Object.entries(raw.params).sort(([left], [right]) => left.localeCompare(right))) }
      : {}),
    ...(raw.maxLaunchesPerSlot === 1 ? { maxLaunchesPerSlot: 1 } : {})
  };

  seenScheduleIds.add(scheduleId);

  return {
    valid: normalized
  };
}

export function loadScheduleRegistry(registryPath: string = DEFAULT_SCHEDULE_REGISTRY_PATH): ScheduleRegistry {
  const resolvedPath = path.resolve(registryPath);
  const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as unknown;

  if (!isRecord(parsed)) {
    throw new Error('Schedule registry must be an object.');
  }
  if (typeof parsed.schemaVersion !== 'number') {
    throw new Error('Schedule registry schemaVersion must be a number.');
  }
  if (!Array.isArray(parsed.schedules)) {
    throw new Error('Schedule registry schedules must be an array.');
  }

  const seen = new Set<string>();
  const validSchedules: MissionSchedule[] = [];
  const invalidSchedules: InvalidMissionSchedule[] = [];

  for (let index = 0; index < parsed.schedules.length; index += 1) {
    const normalized = normalizeSchedule(parsed.schedules[index], index, seen);
    if (normalized.valid) {
      validSchedules.push(normalized.valid);
      continue;
    }
    if (normalized.invalid) {
      invalidSchedules.push(normalized.invalid);
    }
  }

  return {
    schemaVersion: parsed.schemaVersion,
    schedules: [...validSchedules].sort((left, right) => left.scheduleId.localeCompare(right.scheduleId)),
    invalidSchedules: [...invalidSchedules].sort((left, right) => left.scheduleId.localeCompare(right.scheduleId))
  };
}
