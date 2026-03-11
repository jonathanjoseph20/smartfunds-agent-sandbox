import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  SYNTHESIS_STATUSES,
  SynthesisError,
  type SynthesisConfidenceSummary,
  type SynthesisEvent,
  type SynthesisEventRecord,
  type SynthesisLinkReason,
  type SynthesisRecord,
  type SynthesisStatus
} from './synthesis-types.ts';

const DEFAULT_SYNTHESIS_ROOT = 'syntheses';
const SYNTHESIS_LOG_FILE = 'synthesis-events.json';

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

function normalizeStatus(value: unknown): SynthesisStatus {
  if (typeof value !== 'string' || !SYNTHESIS_STATUSES.includes(value as SynthesisStatus)) {
    throw new SynthesisError('SYNTHESIS_INVALID_STORE', 'Synthesis event has invalid status value.');
  }
  return value as SynthesisStatus;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new SynthesisError('SYNTHESIS_INVALID_STORE', 'Expected an array of strings.');
  }
  return Array.from(new Set(value)).sort((left, right) => left.localeCompare(right));
}

function normalizeLinkedReasons(value: unknown): SynthesisLinkReason[] {
  if (!Array.isArray(value)) {
    throw new SynthesisError('SYNTHESIS_INVALID_STORE', 'Expected linkedReasons array.');
  }

  const parsed = value.map((entry) => {
    if (!isRecord(entry)) {
      throw new SynthesisError('SYNTHESIS_INVALID_STORE', 'linkedReason entry must be an object.');
    }
    if (typeof entry.dimension !== 'string' || typeof entry.value !== 'string' || typeof entry.reason !== 'string') {
      throw new SynthesisError('SYNTHESIS_INVALID_STORE', 'linkedReason entry has invalid fields.');
    }
    return {
      dimension: entry.dimension,
      value: entry.value,
      reason: entry.reason
    };
  });

  const byKey = new Map<string, SynthesisLinkReason>();
  for (const reason of parsed) {
    const key = `${reason.dimension}:${reason.value}:${reason.reason}`;
    if (!byKey.has(key)) {
      byKey.set(key, reason);
    }
  }

  return Array.from(byKey.values()).sort((left, right) => {
    const d = left.dimension.localeCompare(right.dimension);
    if (d !== 0) {
      return d;
    }
    const v = left.value.localeCompare(right.value);
    if (v !== 0) {
      return v;
    }
    return left.reason.localeCompare(right.reason);
  });
}

function normalizeEventRecord(value: unknown): SynthesisEventRecord {
  if (!isRecord(value)) {
    throw new SynthesisError('SYNTHESIS_INVALID_STORE', 'Synthesis event must be an object.');
  }

  const sequence = value.sequence;
  const logDate = typeof value.logDate === 'string' ? value.logDate : null;
  const eventType = typeof value.eventType === 'string' ? value.eventType : null;
  const synthesisId = typeof value.synthesisId === 'string' ? value.synthesisId : null;

  if (!Number.isInteger(sequence) || !logDate || !isIsoDate(logDate) || !eventType || !synthesisId) {
    throw new SynthesisError('SYNTHESIS_INVALID_STORE', 'Synthesis event contains invalid required fields.');
  }

  switch (eventType) {
    case 'SYNTHESIS_SET_CREATED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        synthesisId,
        synthesisType: String(value.synthesisType),
        subjectKey: String(value.subjectKey),
        status: normalizeStatus(value.status),
        linkedInvestigationIds: normalizeStringArray(value.linkedInvestigationIds),
        linkedReasons: normalizeLinkedReasons(value.linkedReasons)
      });
    case 'SYNTHESIS_LINKS_UPDATED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        synthesisId,
        linkedInvestigationIds: normalizeStringArray(value.linkedInvestigationIds),
        linkedReasons: normalizeLinkedReasons(value.linkedReasons)
      });
    case 'SYNTHESIS_STATUS_UPDATED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        synthesisId,
        status: normalizeStatus(value.status),
        reason: String(value.reason)
      });
    case 'SYNTHESIS_ARTIFACT_RECORDED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        synthesisId,
        artifactPath: String(value.artifactPath),
        artifactKind: value.artifactKind === 'markdown' ? 'markdown' : 'json'
      });
    case 'SYNTHESIS_CONFIDENCE_UPDATED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        synthesisId,
        overallBand: String(value.overallBand)
      });
    default:
      throw new SynthesisError('SYNTHESIS_INVALID_STORE', `Unknown synthesis eventType: ${eventType}`);
  }
}

function parseEventLog(filePath: string): SynthesisEventRecord[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new SynthesisError('SYNTHESIS_INVALID_STORE', `Synthesis log must be an array: ${filePath}`);
  }
  return parsed.map(normalizeEventRecord);
}

function compareEvent(left: SynthesisEventRecord, right: SynthesisEventRecord): number {
  return left.sequence - right.sequence;
}

function compareRecord(left: SynthesisRecord, right: SynthesisRecord): number {
  const statusWeight = (status: SynthesisStatus): number => {
    if (status === 'active') return 0;
    if (status === 'pending') return 1;
    if (status === 'inconclusive') return 2;
    return 3;
  };

  const statusCmp = statusWeight(left.status) - statusWeight(right.status);
  if (statusCmp !== 0) {
    return statusCmp;
  }
  const typeCmp = left.synthesisType.localeCompare(right.synthesisType);
  if (typeCmp !== 0) {
    return typeCmp;
  }
  const subjectCmp = left.subjectKey.localeCompare(right.subjectKey);
  if (subjectCmp !== 0) {
    return subjectCmp;
  }
  return left.synthesisId.localeCompare(right.synthesisId);
}

function projectRecord(events: SynthesisEventRecord[]): SynthesisRecord {
  const ordered = [...events].sort(compareEvent);
  const created = ordered.find((event) => event.eventType === 'SYNTHESIS_SET_CREATED');
  if (!created || created.eventType !== 'SYNTHESIS_SET_CREATED') {
    throw new SynthesisError('SYNTHESIS_INVALID_STORE', 'Synthesis event stream is missing SYNTHESIS_SET_CREATED.');
  }

  const record: SynthesisRecord = {
    synthesisId: created.synthesisId,
    synthesisType: created.synthesisType,
    subjectKey: created.subjectKey,
    status: created.status,
    linkedInvestigationIds: created.linkedInvestigationIds,
    linkedReasons: created.linkedReasons,
    latestArtifactPaths: []
  };

  for (const event of ordered) {
    switch (event.eventType) {
      case 'SYNTHESIS_SET_CREATED':
        break;
      case 'SYNTHESIS_LINKS_UPDATED':
        record.linkedInvestigationIds = event.linkedInvestigationIds;
        record.linkedReasons = event.linkedReasons;
        break;
      case 'SYNTHESIS_STATUS_UPDATED':
        record.status = event.status;
        break;
      case 'SYNTHESIS_ARTIFACT_RECORDED':
        record.latestArtifactPaths = Array.from(new Set([
          ...record.latestArtifactPaths,
          event.artifactPath
        ])).sort((left, right) => left.localeCompare(right));
        break;
      case 'SYNTHESIS_CONFIDENCE_UPDATED':
        record.latestConfidenceBand = event.overallBand;
        break;
      default:
        break;
    }
  }

  return canonicalClone(record);
}

export function createSynthesisStore(options: { rootDir?: string } = {}) {
  const rootDir = path.resolve(options.rootDir ?? DEFAULT_SYNTHESIS_ROOT);

  function getLogPath(logDate: string): string {
    if (!isIsoDate(logDate)) {
      throw new SynthesisError('SYNTHESIS_INVALID_LOG_DATE', `Invalid synthesis log date: ${logDate}`);
    }
    return path.join(rootDir, logDate, SYNTHESIS_LOG_FILE);
  }

  function appendEvent(input: { logDate: string; event: SynthesisEvent }): { path: string; event: SynthesisEventRecord } {
    const logPath = getLogPath(input.logDate);
    ensureDir(path.dirname(logPath));
    ensureFile(logPath, []);

    const existing = parseEventLog(logPath);
    const nextEvent = normalizeEventRecord({
      sequence: existing.length + 1,
      logDate: input.logDate,
      ...input.event
    });

    fs.writeFileSync(logPath, `${canonicalStringify([...existing, nextEvent])}\n`, 'utf8');

    return {
      path: logPath,
      event: nextEvent
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

  function listEventsByDate(logDate: string): SynthesisEventRecord[] {
    const logPath = getLogPath(logDate);
    if (!fs.existsSync(logPath)) {
      return [];
    }
    return parseEventLog(logPath).sort(compareEvent);
  }

  function listEvents(): SynthesisEventRecord[] {
    return listDates()
      .flatMap((date) => listEventsByDate(date))
      .sort((left, right) => {
        const dateCmp = left.logDate.localeCompare(right.logDate);
        if (dateCmp !== 0) {
          return dateCmp;
        }
        return left.sequence - right.sequence;
      });
  }

  function groupBySynthesisId(): Map<string, SynthesisEventRecord[]> {
    const grouped = new Map<string, SynthesisEventRecord[]>();
    for (const event of listEvents()) {
      const items = grouped.get(event.synthesisId) ?? [];
      items.push(event);
      grouped.set(event.synthesisId, items);
    }
    return grouped;
  }

  function listSynthesisSets(input: {
    synthesisType?: string;
    status?: SynthesisStatus;
  } = {}): SynthesisRecord[] {
    return Array.from(groupBySynthesisId().values())
      .map((events) => projectRecord(events))
      .filter((record) => (input.synthesisType ? record.synthesisType === input.synthesisType : true))
      .filter((record) => (input.status ? record.status === input.status : true))
      .sort(compareRecord);
  }

  function getSynthesisSet(synthesisId: string): SynthesisRecord {
    const events = groupBySynthesisId().get(synthesisId);
    if (!events || events.length === 0) {
      throw new SynthesisError('SYNTHESIS_NOT_FOUND', `Synthesis set not found: ${synthesisId}`);
    }
    return projectRecord(events);
  }

  function getSynthesisHistory(synthesisId: string): SynthesisEventRecord[] {
    const events = groupBySynthesisId().get(synthesisId);
    if (!events || events.length === 0) {
      throw new SynthesisError('SYNTHESIS_NOT_FOUND', `Synthesis set not found: ${synthesisId}`);
    }
    return [...events].sort(compareEvent);
  }

  function listHistory(): Array<{ date: string; synthesisSets: SynthesisRecord[] }> {
    return listDates()
      .map((date) => ({
        date,
        synthesisSets: listSynthesisSets().filter((record) => {
          const history = getSynthesisHistory(record.synthesisId);
          return history.some((event) => event.logDate === date);
        })
      }))
      .filter((entry) => entry.synthesisSets.length > 0)
      .sort((left, right) => right.date.localeCompare(left.date));
  }

  return {
    appendEvent,
    listEvents,
    listEventsByDate,
    listSynthesisSets,
    getSynthesisSet,
    getSynthesisHistory,
    listHistory
  };
}

export type SynthesisStore = ReturnType<typeof createSynthesisStore>;
