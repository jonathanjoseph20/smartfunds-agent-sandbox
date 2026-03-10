import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  InvestigationError,
  type InvestigationEvent,
  type InvestigationEventRecord,
  type InvestigationRecord
} from './investigation-types.ts';

const DEFAULT_INVESTIGATIONS_ROOT = 'investigations';
const INVESTIGATION_LOG_FILE = 'investigation-events.json';

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

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new InvestigationError('INVESTIGATION_INVALID_STORE', 'Expected an array of strings.');
  }

  return [...value].sort((left, right) => left.localeCompare(right));
}

function normalizeEventRecord(value: unknown): InvestigationEventRecord {
  if (!isRecord(value)) {
    throw new InvestigationError('INVESTIGATION_INVALID_STORE', 'Investigation event must be an object.');
  }

  const sequence = value.sequence;
  const logDate = typeof value.logDate === 'string' ? value.logDate : null;
  const eventType = typeof value.eventType === 'string' ? value.eventType : null;
  const investigationRunId = typeof value.investigationRunId === 'string' ? value.investigationRunId : null;

  if (!Number.isInteger(sequence) || !logDate || !isIsoDate(logDate) || !eventType || !investigationRunId) {
    throw new InvestigationError('INVESTIGATION_INVALID_STORE', 'Investigation event contains invalid required fields.');
  }

  switch (eventType) {
    case 'INVESTIGATION_CREATED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        dedupeKey: String(value.dedupeKey),
        investigationDefinitionId: String(value.investigationDefinitionId),
        sourceSignalReference: String(value.sourceSignalReference),
        sourceSignalType: String(value.sourceSignalType),
        ...(typeof value.sourceTriggerId === 'string' ? { sourceTriggerId: value.sourceTriggerId } : {}),
        ...(typeof value.sourceTriggerReference === 'string' ? { sourceTriggerReference: value.sourceTriggerReference } : {}),
        slot: String(value.slot),
        associatedMissionReferences: normalizeStringArray(value.associatedMissionReferences)
      });
    case 'PHASE_STARTED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        phaseId: String(value.phaseId),
        phaseKind: String(value.phaseKind)
      });
    case 'PHASE_COMPLETED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        phaseId: String(value.phaseId),
        phaseKind: String(value.phaseKind),
        findings: normalizeStringArray(value.findings)
      });
    case 'ARTIFACT_RECORDED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        artifactPath: String(value.artifactPath),
        artifactKind: String(value.artifactKind)
      });
    case 'INVESTIGATION_COMPLETED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        finalReportPath: String(value.finalReportPath),
        findings: normalizeStringArray(value.findings)
      });
    case 'INVESTIGATION_FAILED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        phaseId: String(value.phaseId),
        reason: String(value.reason)
      });
    default:
      throw new InvestigationError(
        'INVESTIGATION_INVALID_STORE',
        `Unknown investigation eventType: ${eventType}`
      );
  }
}

function parseEventLog(filePath: string): InvestigationEventRecord[] {
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!Array.isArray(parsed)) {
    throw new InvestigationError('INVESTIGATION_INVALID_STORE', `Investigation log must be an array: ${filePath}`);
  }

  return parsed.map(normalizeEventRecord);
}

function compareEvent(left: InvestigationEventRecord, right: InvestigationEventRecord): number {
  return left.sequence - right.sequence;
}

function compareRecord(left: InvestigationRecord, right: InvestigationRecord): number {
  const dateCmp = right.logDate.localeCompare(left.logDate);
  if (dateCmp !== 0) {
    return dateCmp;
  }
  const definitionCmp = left.investigationDefinitionId.localeCompare(right.investigationDefinitionId);
  if (definitionCmp !== 0) {
    return definitionCmp;
  }
  return left.investigationRunId.localeCompare(right.investigationRunId);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function projectRecord(events: InvestigationEventRecord[]): InvestigationRecord {
  const ordered = [...events].sort(compareEvent);
  const created = ordered.find((event) => event.eventType === 'INVESTIGATION_CREATED');
  if (!created || created.eventType !== 'INVESTIGATION_CREATED') {
    throw new InvestigationError('INVESTIGATION_INVALID_STORE', 'Investigation event stream is missing INVESTIGATION_CREATED.');
  }

  const record: InvestigationRecord = {
    investigationRunId: created.investigationRunId,
    dedupeKey: created.dedupeKey,
    investigationDefinitionId: created.investigationDefinitionId,
    sourceSignalReference: created.sourceSignalReference,
    sourceSignalType: created.sourceSignalType,
    ...(created.sourceTriggerId ? { sourceTriggerId: created.sourceTriggerId } : {}),
    ...(created.sourceTriggerReference ? { sourceTriggerReference: created.sourceTriggerReference } : {}),
    slot: created.slot,
    logDate: created.logDate,
    status: 'pending',
    completedPhaseIds: [],
    artifactPaths: [],
    associatedMissionReferences: created.associatedMissionReferences,
    findings: []
  };

  for (const event of ordered) {
    switch (event.eventType) {
      case 'INVESTIGATION_CREATED':
        break;
      case 'PHASE_STARTED':
        record.status = 'running';
        record.currentPhaseId = event.phaseId;
        break;
      case 'PHASE_COMPLETED':
        record.status = 'running';
        record.currentPhaseId = event.phaseId;
        record.completedPhaseIds = uniqueSorted([...record.completedPhaseIds, event.phaseId]);
        record.findings = uniqueSorted([...record.findings, ...event.findings]);
        break;
      case 'ARTIFACT_RECORDED':
        record.artifactPaths = uniqueSorted([...record.artifactPaths, event.artifactPath]);
        break;
      case 'INVESTIGATION_COMPLETED':
        record.status = 'completed';
        record.finalReportPath = event.finalReportPath;
        record.findings = uniqueSorted([...record.findings, ...event.findings]);
        break;
      case 'INVESTIGATION_FAILED':
        record.status = 'failed';
        record.failureReason = event.reason;
        record.currentPhaseId = event.phaseId;
        break;
      default:
        break;
    }
  }

  return canonicalClone(record);
}

export function createInvestigationStore(options: { rootDir?: string } = {}) {
  const rootDir = path.resolve(options.rootDir ?? DEFAULT_INVESTIGATIONS_ROOT);

  function getLogPath(logDate: string): string {
    if (!isIsoDate(logDate)) {
      throw new InvestigationError('INVESTIGATION_INVALID_LOG_DATE', `Invalid investigation log date: ${logDate}`);
    }
    return path.join(rootDir, logDate, INVESTIGATION_LOG_FILE);
  }

  function appendEvent(input: { logDate: string; event: InvestigationEvent }): { path: string; event: InvestigationEventRecord } {
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

  function listEventsByDate(logDate: string): InvestigationEventRecord[] {
    const logPath = getLogPath(logDate);
    if (!fs.existsSync(logPath)) {
      return [];
    }
    return parseEventLog(logPath).sort(compareEvent);
  }

  function listEvents(): InvestigationEventRecord[] {
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

  function groupByRunId(): Map<string, InvestigationEventRecord[]> {
    const grouped = new Map<string, InvestigationEventRecord[]>();
    for (const event of listEvents()) {
      const events = grouped.get(event.investigationRunId) ?? [];
      events.push(event);
      grouped.set(event.investigationRunId, events);
    }
    return grouped;
  }

  function listInvestigations(input: {
    status?: InvestigationRecord['status'];
    sourceTriggerId?: string;
    sourceSignalType?: string;
  } = {}): InvestigationRecord[] {
    return Array.from(groupByRunId().values())
      .map((events) => projectRecord(events))
      .filter((record) => (input.status ? record.status === input.status : true))
      .filter((record) => (input.sourceTriggerId ? record.sourceTriggerId === input.sourceTriggerId : true))
      .filter((record) => (input.sourceSignalType ? record.sourceSignalType === input.sourceSignalType : true))
      .sort(compareRecord);
  }

  function getInvestigation(investigationRunId: string): InvestigationRecord {
    const events = groupByRunId().get(investigationRunId);
    if (!events || events.length === 0) {
      throw new InvestigationError('INVESTIGATION_NOT_FOUND', `Investigation run not found: ${investigationRunId}`);
    }
    return projectRecord(events);
  }

  function getInvestigationHistory(investigationRunId: string): InvestigationEventRecord[] {
    const events = groupByRunId().get(investigationRunId);
    if (!events || events.length === 0) {
      throw new InvestigationError('INVESTIGATION_NOT_FOUND', `Investigation run not found: ${investigationRunId}`);
    }
    return [...events].sort(compareEvent);
  }

  function hasInvestigationByDedupeKey(dedupeKey: string): boolean {
    return listInvestigations().some((record) => record.dedupeKey === dedupeKey);
  }

  function listHistory(): Array<{ date: string; investigations: InvestigationRecord[] }> {
    return listDates()
      .map((date) => ({
        date,
        investigations: listInvestigations().filter((record) => record.logDate === date)
      }))
      .filter((entry) => entry.investigations.length > 0)
      .map((entry) => ({
        date: entry.date,
        investigations: entry.investigations.sort(compareRecord)
      }))
      .sort((left, right) => right.date.localeCompare(left.date));
  }

  return {
    appendEvent,
    listEvents,
    listEventsByDate,
    listInvestigations,
    getInvestigation,
    getInvestigationHistory,
    hasInvestigationByDedupeKey,
    listHistory
  };
}

export type InvestigationStore = ReturnType<typeof createInvestigationStore>;
