import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  deriveActivationRuntimeIntegrationHistoryEventDedupeKey,
  normalizeCanonicalRecord,
  uniqueSortedStrings,
} from './activation-runtime-integration-identity.ts';
import {
  ACTIVATION_RUNTIME_INTEGRATION_HISTORY_EVENT_TYPES,
  type ActivationRuntimeIntegrationHistory,
  type ActivationRuntimeIntegrationHistoryEvent,
  type ActivationRuntimeIntegrationHistoryEventType,
} from './activation-runtime-integration-types.ts';
import { resolveMissionControlArtifactsRoot } from './mission-run-history-store.ts';

function normalizeRelativeSegment(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.length === 0 || normalized.includes('..') || normalized.includes('/')) {
    throw new Error(`INVALID_${fieldName.toUpperCase()}: ${value}`);
  }
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseEventType(value: unknown): ActivationRuntimeIntegrationHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return ACTIVATION_RUNTIME_INTEGRATION_HISTORY_EVENT_TYPES.includes(parsed as ActivationRuntimeIntegrationHistoryEventType)
    ? (parsed as ActivationRuntimeIntegrationHistoryEventType)
    : null;
}

function parseEntry(value: unknown): ActivationRuntimeIntegrationHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('ACTIVATION_RUNTIME_INTEGRATION_INVALID_HISTORY_ENTRY');
  }

  const activationDispatchAttemptId = asString(value.activationDispatchAttemptId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!activationDispatchAttemptId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('ACTIVATION_RUNTIME_INTEGRATION_INVALID_HISTORY_ENTRY');
  }

  return {
    activationDispatchAttemptId,
    eventType,
    eventDedupeKey,
    reasonTokens: uniqueSortedStrings(
      Array.isArray(value.reasonTokens)
        ? value.reasonTokens.filter((entry): entry is string => typeof entry === 'string')
        : []
    ),
    payload: normalizeCanonicalRecord(value.payload),
  };
}

function compareEntries(left: ActivationRuntimeIntegrationHistoryEvent, right: ActivationRuntimeIntegrationHistoryEvent): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function readHistoryFile(filePath: string, fallback: ActivationRuntimeIntegrationHistory): ActivationRuntimeIntegrationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('ACTIVATION_RUNTIME_INTEGRATION_INVALID_HISTORY');
  }

  const activationDispatchAttemptId = asString(parsed.activationDispatchAttemptId);
  if (!activationDispatchAttemptId) {
    throw new Error('ACTIVATION_RUNTIME_INTEGRATION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    activationDispatchAttemptId,
    entries,
  };
}

export function resolveActivationRuntimeIntegrationArtifactDir(input: {
  activationDispatchAttemptId: string;
  rootDir?: string;
}): string {
  const activationDispatchAttemptId = normalizeRelativeSegment(
    input.activationDispatchAttemptId,
    'activation_dispatch_attempt_id'
  );

  return path.join(
    path.resolve(input.rootDir ?? resolveMissionControlArtifactsRoot()),
    'runtime-integration',
    activationDispatchAttemptId
  );
}

export function ensureActivationRuntimeIntegrationArtifactDir(input: {
  activationDispatchAttemptId: string;
  rootDir?: string;
}): string {
  const dirPath = resolveActivationRuntimeIntegrationArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveActivationRuntimeIntegrationArtifactPaths(input: {
  activationDispatchAttemptId: string;
  rootDir?: string;
}): {
  dirPath: string;
  dispatchStatusJsonPath: string;
  dispatchQueueJsonPath: string;
  runtimeLinksJsonPath: string;
  feedbackIngestionJsonPath: string;
  reconciliationJsonPath: string;
  historyJsonPath: string;
  outcomeJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveActivationRuntimeIntegrationArtifactDir(input);

  return {
    dirPath,
    dispatchStatusJsonPath: path.join(dirPath, 'activation-runtime-dispatch-status.json'),
    dispatchQueueJsonPath: path.join(dirPath, 'activation-runtime-dispatch-queue.json'),
    runtimeLinksJsonPath: path.join(dirPath, 'activation-runtime-links.json'),
    feedbackIngestionJsonPath: path.join(dirPath, 'activation-runtime-feedback-ingestion.json'),
    reconciliationJsonPath: path.join(dirPath, 'activation-runtime-reconciliation.json'),
    historyJsonPath: path.join(dirPath, 'activation-runtime-history.json'),
    outcomeJsonPath: path.join(dirPath, 'activation-runtime-outcome.json'),
    reportJsonPath: path.join(dirPath, 'activation-runtime-report.json'),
    reportMarkdownPath: path.join(dirPath, 'activation-runtime-report.md'),
  };
}

export function createActivationRuntimeIntegrationHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? resolveMissionControlArtifactsRoot());

  function load(input: { activationDispatchAttemptId: string }): ActivationRuntimeIntegrationHistory {
    const paths = resolveActivationRuntimeIntegrationArtifactPaths({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      entries: [],
    });
  }

  function appendEvent(input: {
    activationDispatchAttemptId: string;
    eventType: ActivationRuntimeIntegrationHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): { history: ActivationRuntimeIntegrationHistory; appended: boolean; entry: ActivationRuntimeIntegrationHistoryEvent } {
    ensureActivationRuntimeIntegrationArtifactDir({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      rootDir: artifactsRoot,
    });

    const entry: ActivationRuntimeIntegrationHistoryEvent = {
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      eventType: input.eventType,
      eventDedupeKey: deriveActivationRuntimeIntegrationHistoryEventDedupeKey(input),
      reasonTokens: uniqueSortedStrings(input.reasonTokens),
      payload: normalizeCanonicalRecord(input.payload),
    };

    const current = load({ activationDispatchAttemptId: input.activationDispatchAttemptId });
    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return { history: current, appended: false, entry };
    }

    const next: ActivationRuntimeIntegrationHistory = {
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    const paths = resolveActivationRuntimeIntegrationArtifactPaths({
      activationDispatchAttemptId: input.activationDispatchAttemptId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return { history: next, appended: true, entry };
  }

  function replay(input: { activationDispatchAttemptId: string }): ActivationRuntimeIntegrationHistoryEvent[] {
    return [...load(input).entries].sort(compareEntries);
  }

  function write(history: ActivationRuntimeIntegrationHistory): string {
    ensureActivationRuntimeIntegrationArtifactDir({
      activationDispatchAttemptId: history.activationDispatchAttemptId,
      rootDir: artifactsRoot,
    });

    const normalized: ActivationRuntimeIntegrationHistory = {
      activationDispatchAttemptId: history.activationDispatchAttemptId,
      entries: [...history.entries].sort(compareEntries),
    };

    const paths = resolveActivationRuntimeIntegrationArtifactPaths({
      activationDispatchAttemptId: history.activationDispatchAttemptId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(normalized)}\n`, 'utf8');
    return paths.historyJsonPath;
  }

  return {
    appendEvent,
    load,
    replay,
    write,
  };
}

export type ActivationRuntimeIntegrationHistoryStore = ReturnType<typeof createActivationRuntimeIntegrationHistoryStore>;
