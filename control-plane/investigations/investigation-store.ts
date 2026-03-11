import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  InvestigationError,
  type InvestigationEvent,
  type InvestigationEventRecord,
  type InvestigationRecord,
  type InvestigationStatus,
} from './investigation-types.ts';
import { isInvestigationStatus } from './investigation-lifecycle.ts';

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

function normalizeStatus(value: unknown): InvestigationStatus {
  if (typeof value !== 'string' || !isInvestigationStatus(value)) {
    throw new InvestigationError('INVESTIGATION_INVALID_STORE', 'Investigation event has invalid status value.');
  }
  return value;
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
    case 'LIFECYCLE_TRANSITION_RECORDED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        ...(typeof value.phaseId === 'string' ? { phaseId: value.phaseId } : {}),
        fromStatus: normalizeStatus(value.fromStatus),
        toStatus: normalizeStatus(value.toStatus),
        reason: String(value.reason),
        ...(typeof value.schedulerSlot === 'string' ? { schedulerSlot: value.schedulerSlot } : {}),
        ...(typeof value.nextEligibleSlot === 'string' ? { nextEligibleSlot: value.nextEligibleSlot } : {}),
        ...(typeof value.waitingReason === 'string' ? { waitingReason: value.waitingReason } : {}),
        ...(typeof value.waitCondition === 'string' ? { waitCondition: value.waitCondition } : {}),
        ...(Number.isInteger(value.retryIndex) ? { retryIndex: Number(value.retryIndex) } : {})
      });
    case 'PHASE_SLOT_ADVANCEMENT_RECORDED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        phaseId: String(value.phaseId),
        schedulerSlot: String(value.schedulerSlot)
      });
    case 'PHASE_STARTED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        phaseId: String(value.phaseId),
        phaseKind: String(value.phaseKind),
        ...(typeof value.schedulerSlot === 'string' ? { schedulerSlot: value.schedulerSlot } : {})
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
    case 'PHASE_RETRY_SCHEDULED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        phaseId: String(value.phaseId),
        reason: String(value.reason),
        retryIndex: Number(value.retryIndex),
        nextEligibleSlot: String(value.nextEligibleSlot),
        schedulerSlot: String(value.schedulerSlot)
      });
    case 'PHASE_WAITING_FOR_DATA':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        phaseId: String(value.phaseId),
        reason: String(value.reason),
        waitCondition: String(value.waitCondition),
        ...(typeof value.nextEligibleSlot === 'string' ? { nextEligibleSlot: value.nextEligibleSlot } : {}),
        schedulerSlot: String(value.schedulerSlot)
      });
    case 'PHASE_SCHEDULED_RESUME':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        phaseId: String(value.phaseId),
        reason: String(value.reason),
        nextEligibleSlot: String(value.nextEligibleSlot),
        schedulerSlot: String(value.schedulerSlot)
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
    case 'INVESTIGATION_FINALIZATION_SIGNAL_EMITTED':
      return canonicalClone({
        sequence,
        logDate,
        eventType,
        investigationRunId,
        signalType: String(value.signalType),
        signalFingerprint: String(value.signalFingerprint),
        toReadinessState: String(value.toReadinessState),
        toHealthState: String(value.toHealthState),
        ...(typeof value.fromReadinessState === 'string' ? { fromReadinessState: value.fromReadinessState } : {}),
        ...(typeof value.fromHealthState === 'string' ? { fromHealthState: value.fromHealthState } : {})
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
  const terminalWeight = (status: InvestigationStatus): number => {
    if (status === 'running') return 0;
    if (status === 'scheduled_resume') return 1;
    if (status === 'retry_pending') return 2;
    if (status === 'awaiting_data') return 3;
    if (status === 'pending') return 4;
    if (status === 'blocked') return 5;
    if (status === 'failed') return 6;
    if (status === 'cancelled') return 7;
    return 8;
  };

  const statusCmp = terminalWeight(left.status) - terminalWeight(right.status);
  if (statusCmp !== 0) {
    return statusCmp;
  }
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
    findings: [],
    retryCountByPhase: {}
  };

  for (const event of ordered) {
    switch (event.eventType) {
      case 'INVESTIGATION_CREATED':
        break;
      case 'LIFECYCLE_TRANSITION_RECORDED':
        record.status = event.toStatus;
        record.lastAttemptedTransition = `${event.fromStatus}->${event.toStatus}:${event.reason}`;
        if (event.phaseId) {
          record.currentPhaseId = event.phaseId;
        }
        if (event.nextEligibleSlot) {
          record.nextEligibleSlot = event.nextEligibleSlot;
        } else if (event.toStatus === 'running' || event.toStatus === 'completed' || event.toStatus === 'failed') {
          delete record.nextEligibleSlot;
        }
        if (event.waitingReason) {
          record.waitingReason = event.waitingReason;
        } else if (event.toStatus !== 'awaiting_data' && event.toStatus !== 'scheduled_resume' && event.toStatus !== 'retry_pending') {
          delete record.waitingReason;
        }
        if (event.waitCondition) {
          record.waitCondition = event.waitCondition;
        } else if (event.toStatus !== 'awaiting_data') {
          delete record.waitCondition;
        }
        break;
      case 'PHASE_SLOT_ADVANCEMENT_RECORDED':
        record.lastAttemptedTransition = `phase_slot:${event.phaseId}:${event.schedulerSlot}`;
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
        record.lastPhaseResult = {
          phaseId: event.phaseId,
          outcome: 'completed',
          reason: 'phase_completed',
          findings: uniqueSorted(event.findings)
        };
        break;
      case 'PHASE_RETRY_SCHEDULED':
        record.status = 'retry_pending';
        record.currentPhaseId = event.phaseId;
        record.nextEligibleSlot = event.nextEligibleSlot;
        record.waitingReason = event.reason;
        record.retryCountByPhase = {
          ...record.retryCountByPhase,
          [event.phaseId]: event.retryIndex
        };
        record.lastPhaseResult = {
          phaseId: event.phaseId,
          outcome: 'retry_scheduled',
          reason: event.reason,
          findings: []
        };
        break;
      case 'PHASE_WAITING_FOR_DATA':
        record.status = 'awaiting_data';
        record.currentPhaseId = event.phaseId;
        record.waitingReason = event.reason;
        record.waitCondition = event.waitCondition;
        if (event.nextEligibleSlot) {
          record.nextEligibleSlot = event.nextEligibleSlot;
        }
        record.lastPhaseResult = {
          phaseId: event.phaseId,
          outcome: 'awaiting_data',
          reason: event.reason,
          findings: []
        };
        break;
      case 'PHASE_SCHEDULED_RESUME':
        record.status = 'scheduled_resume';
        record.currentPhaseId = event.phaseId;
        record.waitingReason = event.reason;
        record.nextEligibleSlot = event.nextEligibleSlot;
        record.lastPhaseResult = {
          phaseId: event.phaseId,
          outcome: 'scheduled_resume',
          reason: event.reason,
          findings: []
        };
        break;
      case 'ARTIFACT_RECORDED':
        record.artifactPaths = uniqueSorted([...record.artifactPaths, event.artifactPath]);
        break;
      case 'INVESTIGATION_COMPLETED':
        record.status = 'completed';
        record.finalReportPath = event.finalReportPath;
        record.findings = uniqueSorted([...record.findings, ...event.findings]);
        record.lastPhaseResult = {
          phaseId: record.currentPhaseId ?? 'finalize',
          outcome: 'completed',
          reason: 'investigation_completed',
          findings: uniqueSorted(event.findings)
        };
        delete record.nextEligibleSlot;
        delete record.waitingReason;
        delete record.waitCondition;
        break;
      case 'INVESTIGATION_FAILED':
        record.status = 'failed';
        record.failureReason = event.reason;
        record.currentPhaseId = event.phaseId;
        record.lastPhaseResult = {
          phaseId: event.phaseId,
          outcome: 'failed',
          reason: event.reason,
          findings: []
        };
        delete record.nextEligibleSlot;
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

  function hasPhaseAdvancementForSlot(input: { investigationRunId: string; phaseId: string; schedulerSlot: string }): boolean {
    const events = groupByRunId().get(input.investigationRunId) ?? [];
    return events.some((event) => (
      event.eventType === 'PHASE_SLOT_ADVANCEMENT_RECORDED'
      && event.phaseId === input.phaseId
      && event.schedulerSlot === input.schedulerSlot
    ));
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
    hasPhaseAdvancementForSlot,
    hasInvestigationByDedupeKey,
    listHistory
  };
}

export type InvestigationStore = ReturnType<typeof createInvestigationStore>;
