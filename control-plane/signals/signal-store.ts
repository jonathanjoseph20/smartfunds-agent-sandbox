import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import type { SignalRecord } from './signal-types.ts';
import { SignalError } from './signal-types.ts';

const DEFAULT_SIGNALS_ROOT = 'signals';
const SIGNAL_LOG_FILE = 'signal-log.json';

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

function compareSignals(left: SignalRecord, right: SignalRecord): number {
  const dateCmp = right.logDate.localeCompare(left.logDate);
  if (dateCmp !== 0) {
    return dateCmp;
  }
  const typeCmp = left.signalType.localeCompare(right.signalType);
  if (typeCmp !== 0) {
    return typeCmp;
  }
  const datasetCmp = left.dataset.localeCompare(right.dataset);
  if (datasetCmp !== 0) {
    return datasetCmp;
  }
  const slotCmp = right.slot.localeCompare(left.slot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.dedupeKey.localeCompare(right.dedupeKey);
}

function normalizeSignalRecord(value: unknown): SignalRecord {
  if (!isRecord(value)) {
    throw new SignalError('SIGNAL_INVALID_RECORD', 'Signal record must be an object.');
  }

  const signalType = typeof value.signalType === 'string' ? value.signalType : null;
  const sourceMission = typeof value.sourceMission === 'string' ? value.sourceMission : null;
  const dataset = typeof value.dataset === 'string' ? value.dataset : null;
  const slot = typeof value.slot === 'string' ? value.slot : null;
  const dedupeKey = typeof value.dedupeKey === 'string' ? value.dedupeKey : null;
  const logDate = typeof value.logDate === 'string' ? value.logDate : null;

  if (!signalType || !sourceMission || !dataset || !slot || !dedupeKey || !logDate || !isIsoDate(logDate)) {
    throw new SignalError('SIGNAL_INVALID_RECORD', 'Signal record contains invalid required fields.');
  }

  if (!isRecord(value.metadata)) {
    throw new SignalError('SIGNAL_INVALID_RECORD', 'Signal record metadata must be an object.');
  }

  const artifactReference = typeof value.artifactReference === 'string' ? value.artifactReference : undefined;

  return canonicalClone({
    signalType,
    sourceMission,
    dataset,
    ...(artifactReference ? { artifactReference } : {}),
    metadata: value.metadata,
    slot,
    dedupeKey,
    logDate
  });
}

function parseSignalLog(filePath: string): SignalRecord[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new SignalError('SIGNAL_INVALID_STORE', `Signal log must be an array: ${filePath}`);
  }

  return parsed.map(normalizeSignalRecord);
}

export function createSignalStore(options: { rootDir?: string } = {}) {
  const rootDir = path.resolve(options.rootDir ?? DEFAULT_SIGNALS_ROOT);

  function getLogPath(logDate: string): string {
    if (!isIsoDate(logDate)) {
      throw new SignalError('SIGNAL_INVALID_LOG_DATE', `Invalid signal logDate: ${logDate}`);
    }
    return path.join(rootDir, logDate, SIGNAL_LOG_FILE);
  }

  function appendSignal(signal: SignalRecord): { appended: boolean; path: string } {
    const normalized = normalizeSignalRecord(signal);
    const logPath = getLogPath(normalized.logDate);
    ensureDir(path.dirname(logPath));
    ensureFile(logPath, []);

    const existing = parseSignalLog(logPath);
    if (existing.some((entry) => entry.dedupeKey === normalized.dedupeKey)) {
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

  function listSignalsByDate(logDate: string): SignalRecord[] {
    const logPath = getLogPath(logDate);
    if (!fs.existsSync(logPath)) {
      return [];
    }

    return parseSignalLog(logPath).sort(compareSignals);
  }

  function listSignals(input: { signalType?: string; limit?: number } = {}): SignalRecord[] {
    const rows = listDates()
      .flatMap((date) => listSignalsByDate(date))
      .filter((entry) => (input.signalType ? entry.signalType === input.signalType : true))
      .sort(compareSignals);

    if (input.limit === undefined) {
      return rows;
    }

    return rows.slice(0, input.limit);
  }

  function listHistory(): Array<{ date: string; signals: SignalRecord[] }> {
    return listDates()
      .map((date) => ({ date, signals: listSignalsByDate(date) }))
      .filter((entry) => entry.signals.length > 0)
      .sort((left, right) => right.date.localeCompare(left.date));
  }

  function hasDedupeKey(dedupeKey: string): boolean {
    for (const date of listDates()) {
      const signals = listSignalsByDate(date);
      if (signals.some((entry) => entry.dedupeKey === dedupeKey)) {
        return true;
      }
    }

    return false;
  }

  return {
    appendSignal,
    hasDedupeKey,
    listSignals,
    listSignalsByDate,
    listHistory
  };
}

export type SignalStore = ReturnType<typeof createSignalStore>;
