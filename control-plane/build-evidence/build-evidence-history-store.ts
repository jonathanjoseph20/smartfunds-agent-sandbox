import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  BuildEvidenceHistoryEvent,
  BuildEvidenceHistoryEventType,
} from './build-evidence-types.ts';

const DEFAULT_BUILD_EVIDENCE_HISTORY_FILE = path.join(
  'runtime-data',
  'build-evidence',
  'build-evidence-history.json',
);

const EVENT_TYPE_ORDER: Record<BuildEvidenceHistoryEventType, number> = {
  build_evidence_bundle_created: 0,
  artifact_verification_recorded: 1,
  prompt_attestation_recorded: 2,
  execution_plan_attestation_recorded: 3,
  build_evidence_governance_validated: 4,
  build_evidence_materialized: 5,
  build_evidence_failed: 6,
};

type BuildEvidenceHistoryStoreFile = {
  entries: BuildEvidenceHistoryEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEvent(value: unknown): BuildEvidenceHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('BUILD_EVIDENCE_INVALID_HISTORY_EVENT');
  }

  const buildEvidenceBundleId = asString(value.buildEvidenceBundleId);
  const runId = asString(value.runId);
  const eventType = asString(value.eventType) as BuildEvidenceHistoryEventType;
  const payloadHash = asString(value.payloadHash);

  if (!buildEvidenceBundleId || !runId || !eventType || !payloadHash || !isRecord(value.payload)) {
    throw new Error('BUILD_EVIDENCE_INVALID_HISTORY_EVENT');
  }

  return {
    buildEvidenceBundleId,
    runId,
    eventType,
    payloadHash,
    payload: JSON.parse(canonicalStringify(value.payload)) as Record<string, unknown>,
  };
}

function computeEventHash(event: BuildEvidenceHistoryEvent): string {
  return sha256(canonicalStringify({
    buildEvidenceBundleId: event.buildEvidenceBundleId,
    runId: event.runId,
    eventType: event.eventType,
    payloadHash: event.payloadHash,
  }));
}

function compareEvents(left: BuildEvidenceHistoryEvent, right: BuildEvidenceHistoryEvent): number {
  const byBundle = left.buildEvidenceBundleId.localeCompare(right.buildEvidenceBundleId);
  if (byBundle !== 0) {
    return byBundle;
  }

  const byType = EVENT_TYPE_ORDER[left.eventType] - EVENT_TYPE_ORDER[right.eventType];
  if (byType !== 0) {
    return byType;
  }

  const byPayloadHash = left.payloadHash.localeCompare(right.payloadHash);
  if (byPayloadHash !== 0) {
    return byPayloadHash;
  }

  return computeEventHash(left).localeCompare(computeEventHash(right));
}

function readHistory(filePath: string): BuildEvidenceHistoryStoreFile {
  if (!fs.existsSync(filePath)) {
    return { entries: [] };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('BUILD_EVIDENCE_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEvent(entry)).sort(compareEvents)
    : [];

  return { entries };
}

function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function createBuildEvidenceHistoryStore(options: {
  historyFilePath?: string;
} = {}) {
  const historyFilePath = options.historyFilePath ?? DEFAULT_BUILD_EVIDENCE_HISTORY_FILE;

  function appendBuildEvidenceEvent(event: BuildEvidenceHistoryEvent): {
    appended: boolean;
    event: BuildEvidenceHistoryEvent;
    entries: BuildEvidenceHistoryEvent[];
  } {
    ensureParentDir(historyFilePath);

    const normalizedEvent: BuildEvidenceHistoryEvent = {
      buildEvidenceBundleId: event.buildEvidenceBundleId,
      runId: event.runId,
      eventType: event.eventType,
      payloadHash: event.payloadHash,
      payload: JSON.parse(canonicalStringify(event.payload)) as Record<string, unknown>,
    };

    const current = readHistory(historyFilePath);
    const nextHash = computeEventHash(normalizedEvent);

    if (current.entries.some((entry) => computeEventHash(entry) === nextHash)) {
      return {
        appended: false,
        event: normalizedEvent,
        entries: current.entries,
      };
    }

    const entries = [...current.entries, normalizedEvent].sort(compareEvents);
    fs.writeFileSync(historyFilePath, `${canonicalStringify({ entries })}\n`, 'utf8');

    return {
      appended: true,
      event: normalizedEvent,
      entries,
    };
  }

  function listBuildEvidenceEvents(buildEvidenceBundleId: string): BuildEvidenceHistoryEvent[] {
    return readHistory(historyFilePath).entries
      .filter((entry) => entry.buildEvidenceBundleId === buildEvidenceBundleId)
      .sort(compareEvents);
  }

  function listAllBuildEvidenceEvents(): BuildEvidenceHistoryEvent[] {
    return readHistory(historyFilePath).entries;
  }

  return {
    appendBuildEvidenceEvent,
    listBuildEvidenceEvents,
    listAllBuildEvidenceEvents,
  };
}

export type BuildEvidenceHistoryStore = ReturnType<typeof createBuildEvidenceHistoryStore>;
