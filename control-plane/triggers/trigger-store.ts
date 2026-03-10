import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import type { TriggerRecord } from './trigger-types.ts';
import { TriggerError } from './trigger-types.ts';

const DEFAULT_TRIGGERS_ROOT = 'triggers';
const TRIGGER_LOG_FILE = 'trigger-log.json';

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureFile(filePath: string, defaultValue: unknown): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${canonicalStringify(defaultValue)}\n`, 'utf8');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function canonicalClone<T>(value: T): T {
  return JSON.parse(canonicalStringify(value)) as T;
}

function normalizeTriggerRecord(value: unknown): TriggerRecord {
  if (!isRecord(value)) {
    throw new TriggerError('TRIGGER_INVALID_RECORD', 'Trigger record must be an object.');
  }

  const triggerId = typeof value.triggerId === 'string' ? value.triggerId : null;
  const signalReference = typeof value.signalReference === 'string' ? value.signalReference : null;
  const missionLaunched = typeof value.missionLaunched === 'string' ? value.missionLaunched : null;
  const slot = typeof value.slot === 'string' ? value.slot : null;

  if (!triggerId || !signalReference || !missionLaunched || !slot) {
    throw new TriggerError('TRIGGER_INVALID_RECORD', 'Trigger record contains invalid required fields.');
  }

  return canonicalClone({
    triggerId,
    signalReference,
    missionLaunched,
    slot
  });
}

function parseTriggerLog(filePath: string): TriggerRecord[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new TriggerError('TRIGGER_INVALID_STORE', `Trigger log must be an array: ${filePath}`);
  }

  return parsed.map(normalizeTriggerRecord);
}

function compareTriggers(left: TriggerRecord, right: TriggerRecord): number {
  const triggerCmp = left.triggerId.localeCompare(right.triggerId);
  if (triggerCmp !== 0) {
    return triggerCmp;
  }
  const slotCmp = right.slot.localeCompare(left.slot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  const signalCmp = left.signalReference.localeCompare(right.signalReference);
  if (signalCmp !== 0) {
    return signalCmp;
  }
  return left.missionLaunched.localeCompare(right.missionLaunched);
}

export function createTriggerStore(options: { rootDir?: string } = {}) {
  const rootDir = path.resolve(options.rootDir ?? DEFAULT_TRIGGERS_ROOT);

  function getLogPath(logDate: string): string {
    if (!isIsoDate(logDate)) {
      throw new TriggerError('TRIGGER_INVALID_LOG_DATE', `Invalid trigger log date: ${logDate}`);
    }
    return path.join(rootDir, logDate, TRIGGER_LOG_FILE);
  }

  function appendTrigger(input: { logDate: string; record: TriggerRecord }): { appended: boolean; path: string } {
    const normalized = normalizeTriggerRecord(input.record);
    const logPath = getLogPath(input.logDate);

    ensureDir(path.dirname(logPath));
    ensureFile(logPath, []);

    const existing = parseTriggerLog(logPath);
    if (existing.some((entry) => (
      entry.triggerId === normalized.triggerId
      && entry.signalReference === normalized.signalReference
      && entry.slot === normalized.slot
    ))) {
      return {
        appended: false,
        path: logPath
      };
    }

    const next = [...existing, normalized];
    fs.writeFileSync(logPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      appended: true,
      path: logPath
    };
  }

  function listDates(): string[] {
    if (!fs.existsSync(rootDir)) {
      return [];
    }

    return fs.readdirSync(rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isIsoDate(entry.name))
      .map((entry) => entry.name)
      .sort((left, right) => left.localeCompare(right));
  }

  function listByDate(logDate: string): TriggerRecord[] {
    const logPath = getLogPath(logDate);
    if (!fs.existsSync(logPath)) {
      return [];
    }

    return parseTriggerLog(logPath).sort(compareTriggers);
  }

  function listTriggers(input: { triggerId?: string; limit?: number } = {}): TriggerRecord[] {
    const rows = listDates()
      .flatMap((date) => listByDate(date))
      .filter((entry) => (input.triggerId ? entry.triggerId === input.triggerId : true))
      .sort(compareTriggers);

    if (input.limit === undefined) {
      return rows;
    }

    return rows.slice(0, input.limit);
  }

  function listHistory(): Array<{ date: string; triggers: TriggerRecord[] }> {
    return listDates()
      .map((date) => ({ date, triggers: listByDate(date) }))
      .filter((entry) => entry.triggers.length > 0)
      .sort((left, right) => right.date.localeCompare(left.date));
  }

  function hasTrigger(input: { triggerId: string; signalReference: string; slot: string }): boolean {
    for (const date of listDates()) {
      const rows = listByDate(date);
      if (rows.some((entry) => (
        entry.triggerId === input.triggerId
        && entry.signalReference === input.signalReference
        && entry.slot === input.slot
      ))) {
        return true;
      }
    }

    return false;
  }

  return {
    appendTrigger,
    listTriggers,
    listHistory,
    listByDate,
    hasTrigger
  };
}

export type TriggerStore = ReturnType<typeof createTriggerStore>;
