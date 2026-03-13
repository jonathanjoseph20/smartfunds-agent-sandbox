import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  deriveRuntimeOutcomePropagationHistoryEventDedupeKey,
  normalizeCanonicalRecord,
  uniqueSortedStrings,
} from './runtime-outcome-propagation-identity.ts';
import {
  RUNTIME_OUTCOME_PROPAGATION_HISTORY_EVENT_TYPES,
  type RuntimeOutcomePropagationHistory,
  type RuntimeOutcomePropagationHistoryEvent,
  type RuntimeOutcomePropagationHistoryEventType,
} from './runtime-outcome-propagation-types.ts';
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

function parseEventType(value: unknown): RuntimeOutcomePropagationHistoryEventType | null {
  const parsed = asString(value);
  if (!parsed) {
    return null;
  }

  return RUNTIME_OUTCOME_PROPAGATION_HISTORY_EVENT_TYPES.includes(parsed as RuntimeOutcomePropagationHistoryEventType)
    ? parsed as RuntimeOutcomePropagationHistoryEventType
    : null;
}

function parseEntry(value: unknown): RuntimeOutcomePropagationHistoryEvent {
  if (!isRecord(value)) {
    throw new Error('RUNTIME_OUTCOME_PROPAGATION_INVALID_HISTORY_ENTRY');
  }

  const runtimeOutcomePropagationRecordId = asString(value.runtimeOutcomePropagationRecordId);
  const eventType = parseEventType(value.eventType);
  const eventDedupeKey = asString(value.eventDedupeKey);

  if (!runtimeOutcomePropagationRecordId || !eventType || !eventDedupeKey || !isRecord(value.payload)) {
    throw new Error('RUNTIME_OUTCOME_PROPAGATION_INVALID_HISTORY_ENTRY');
  }

  return {
    runtimeOutcomePropagationRecordId,
    eventType,
    eventDedupeKey,
    reasonTokens: uniqueSortedStrings(
      Array.isArray(value.reasonTokens) ? value.reasonTokens.filter((entry): entry is string => typeof entry === 'string') : []
    ),
    payload: normalizeCanonicalRecord(value.payload),
  };
}

function compareEntries(left: RuntimeOutcomePropagationHistoryEvent, right: RuntimeOutcomePropagationHistoryEvent): number {
  return left.eventDedupeKey.localeCompare(right.eventDedupeKey);
}

function readHistoryFile(filePath: string, fallback: RuntimeOutcomePropagationHistory): RuntimeOutcomePropagationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('RUNTIME_OUTCOME_PROPAGATION_INVALID_HISTORY');
  }

  const runtimeOutcomePropagationRecordId = asString(parsed.runtimeOutcomePropagationRecordId);
  if (!runtimeOutcomePropagationRecordId) {
    throw new Error('RUNTIME_OUTCOME_PROPAGATION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries)
    ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries)
    : [];

  return {
    runtimeOutcomePropagationRecordId,
    entries,
  };
}

export function resolveRuntimeOutcomePropagationArtifactDir(input: {
  runtimeOutcomePropagationRecordId: string;
  rootDir?: string;
}): string {
  const runtimeOutcomePropagationRecordId = normalizeRelativeSegment(
    input.runtimeOutcomePropagationRecordId,
    'runtime_outcome_propagation_record_id'
  );

  return path.join(path.resolve(input.rootDir ?? resolveMissionControlArtifactsRoot()), 'propagation', runtimeOutcomePropagationRecordId);
}

export function ensureRuntimeOutcomePropagationArtifactDir(input: {
  runtimeOutcomePropagationRecordId: string;
  rootDir?: string;
}): string {
  const dirPath = resolveRuntimeOutcomePropagationArtifactDir(input);
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

export function resolveRuntimeOutcomePropagationArtifactPaths(input: {
  runtimeOutcomePropagationRecordId: string;
  rootDir?: string;
}): {
  dirPath: string;
  statusJsonPath: string;
  activationLifecycleJsonPath: string;
  executionCoordinationJsonPath: string;
  missionOrchestrationJsonPath: string;
  missionPortfolioJsonPath: string;
  historyJsonPath: string;
  outcomeJsonPath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
} {
  const dirPath = resolveRuntimeOutcomePropagationArtifactDir(input);

  return {
    dirPath,
    statusJsonPath: path.join(dirPath, 'runtime-outcome-propagation-status.json'),
    activationLifecycleJsonPath: path.join(dirPath, 'activation-lifecycle-propagation.json'),
    executionCoordinationJsonPath: path.join(dirPath, 'execution-coordination-propagation.json'),
    missionOrchestrationJsonPath: path.join(dirPath, 'mission-orchestration-propagation.json'),
    missionPortfolioJsonPath: path.join(dirPath, 'mission-portfolio-state-propagation.json'),
    historyJsonPath: path.join(dirPath, 'runtime-outcome-propagation-history.json'),
    outcomeJsonPath: path.join(dirPath, 'runtime-outcome-propagation-outcome.json'),
    reportJsonPath: path.join(dirPath, 'runtime-outcome-propagation-report.json'),
    reportMarkdownPath: path.join(dirPath, 'runtime-outcome-propagation-report.md'),
  };
}

export function createRuntimeOutcomePropagationHistoryStore(options: { artifactsRoot?: string } = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? resolveMissionControlArtifactsRoot());

  function load(input: { runtimeOutcomePropagationRecordId: string }): RuntimeOutcomePropagationHistory {
    const paths = resolveRuntimeOutcomePropagationArtifactPaths({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      rootDir: artifactsRoot,
    });

    return readHistoryFile(paths.historyJsonPath, {
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      entries: [],
    });
  }

  function appendEvent(input: {
    runtimeOutcomePropagationRecordId: string;
    eventType: RuntimeOutcomePropagationHistoryEventType;
    reasonTokens?: string[];
    payload: Record<string, unknown>;
  }): { history: RuntimeOutcomePropagationHistory; appended: boolean; entry: RuntimeOutcomePropagationHistoryEvent } {
    ensureRuntimeOutcomePropagationArtifactDir({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      rootDir: artifactsRoot,
    });

    const entry: RuntimeOutcomePropagationHistoryEvent = {
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      eventType: input.eventType,
      eventDedupeKey: deriveRuntimeOutcomePropagationHistoryEventDedupeKey(input),
      reasonTokens: uniqueSortedStrings(input.reasonTokens),
      payload: normalizeCanonicalRecord(input.payload),
    };

    const current = load({ runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId });
    if (current.entries.some((row) => row.eventDedupeKey === entry.eventDedupeKey)) {
      return { history: current, appended: false, entry };
    }

    const next: RuntimeOutcomePropagationHistory = {
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      entries: [...current.entries, entry].sort(compareEntries),
    };

    const paths = resolveRuntimeOutcomePropagationArtifactPaths({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      rootDir: artifactsRoot,
    });

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return { history: next, appended: true, entry };
  }

  function replay(input: { runtimeOutcomePropagationRecordId: string }): RuntimeOutcomePropagationHistoryEvent[] {
    return [...load(input).entries].sort(compareEntries);
  }

  function write(history: RuntimeOutcomePropagationHistory): string {
    ensureRuntimeOutcomePropagationArtifactDir({
      runtimeOutcomePropagationRecordId: history.runtimeOutcomePropagationRecordId,
      rootDir: artifactsRoot,
    });

    const normalized: RuntimeOutcomePropagationHistory = {
      runtimeOutcomePropagationRecordId: history.runtimeOutcomePropagationRecordId,
      entries: [...history.entries].sort(compareEntries),
    };

    const paths = resolveRuntimeOutcomePropagationArtifactPaths({
      runtimeOutcomePropagationRecordId: history.runtimeOutcomePropagationRecordId,
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

export type RuntimeOutcomePropagationHistoryStore = ReturnType<typeof createRuntimeOutcomePropagationHistoryStore>;
