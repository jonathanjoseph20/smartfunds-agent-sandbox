import fs from 'node:fs';

import { canonicalStringify, sha256 } from '../../finance/determinism.ts';

import { ensureCohortEscalationArtifactDir, resolveCohortEscalationArtifactPaths } from './cohort-escalation-runtime-paths.ts';
import type { CohortEscalationHistory, CohortEscalationHistoryEntry, CohortEscalationProjection } from './cohort-escalation-types.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    return [];
  }
  return [...value].sort((left, right) => left.localeCompare(right));
}

function compareEntries(left: CohortEscalationHistoryEntry, right: CohortEscalationHistoryEntry): number {
  const slotCmp = right.slotOrReference.localeCompare(left.slotOrReference);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.transitionDedupeKey.localeCompare(right.transitionDedupeKey);
}

function parseEntry(value: unknown): CohortEscalationHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('COHORT_ESCALATION_INVALID_HISTORY_ENTRY');
  }

  const cohortId = asString(value.cohortId);
  const priorEscalationState = asString(value.priorEscalationState) as CohortEscalationHistoryEntry['priorEscalationState'];
  const nextEscalationState = asString(value.nextEscalationState) as CohortEscalationHistoryEntry['nextEscalationState'];
  const slotOrReference = asString(value.slotOrReference);
  const transitionDedupeKey = asString(value.transitionDedupeKey);

  if (!cohortId || !priorEscalationState || !nextEscalationState || !slotOrReference || !transitionDedupeKey) {
    throw new Error('COHORT_ESCALATION_INVALID_HISTORY_ENTRY');
  }

  return {
    cohortId,
    priorEscalationState,
    nextEscalationState,
    transitionReasons: asStringArray(value.transitionReasons),
    linkedSignals: asStringArray(value.linkedSignals),
    linkedSyntheses: asStringArray(value.linkedSyntheses),
    linkedInvestigations: asStringArray(value.linkedInvestigations),
    slotOrReference,
    transitionDedupeKey
  };
}

function readHistoryFile(filePath: string, fallback: CohortEscalationHistory): CohortEscalationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('COHORT_ESCALATION_INVALID_HISTORY');
  }

  const cohortId = asString(parsed.cohortId);
  if (!cohortId) {
    throw new Error('COHORT_ESCALATION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries) ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntries) : [];
  return {
    cohortId,
    entries
  };
}

export function computeEscalationTransitionDedupeKey(input: {
  cohortId: string;
  priorEscalationState: CohortEscalationHistoryEntry['priorEscalationState'];
  projection: CohortEscalationProjection;
}): string {
  return sha256(canonicalStringify({
    cohortId: input.cohortId,
    nextEscalationState: input.projection.escalationState,
    transitionReasons: input.projection.escalationReasons,
    linkedSignals: input.projection.linkedSignals,
    linkedSyntheses: input.projection.linkedSyntheses,
    linkedInvestigations: input.projection.linkedInvestigations,
    slotOrReference: input.projection.slotOrReference
  }));
}

export function createCohortEscalationHistoryStore(options: { cohortArtifactsRoot?: string } = {}) {
  function load(input: { cohortId: string }): CohortEscalationHistory {
    const paths = resolveCohortEscalationArtifactPaths({
      cohortId: input.cohortId,
      rootDir: options.cohortArtifactsRoot
    });

    return readHistoryFile(paths.historyJsonPath, {
      cohortId: input.cohortId,
      entries: []
    });
  }

  function appendTransition(input: { cohortId: string; projection: CohortEscalationProjection }): {
    history: CohortEscalationHistory;
    appended: boolean;
    entry: CohortEscalationHistoryEntry;
  } {
    ensureCohortEscalationArtifactDir({
      cohortId: input.cohortId,
      rootDir: options.cohortArtifactsRoot
    });

    const paths = resolveCohortEscalationArtifactPaths({
      cohortId: input.cohortId,
      rootDir: options.cohortArtifactsRoot
    });

    const current = load({ cohortId: input.cohortId });
    const priorEscalationState = current.entries[0]?.nextEscalationState ?? 'none';
    const transitionDedupeKey = computeEscalationTransitionDedupeKey({
      cohortId: input.cohortId,
      priorEscalationState,
      projection: input.projection
    });

    const entry: CohortEscalationHistoryEntry = {
      cohortId: input.cohortId,
      priorEscalationState,
      nextEscalationState: input.projection.escalationState,
      transitionReasons: [...input.projection.escalationReasons],
      linkedSignals: [...input.projection.linkedSignals],
      linkedSyntheses: [...input.projection.linkedSyntheses],
      linkedInvestigations: [...input.projection.linkedInvestigations],
      slotOrReference: input.projection.slotOrReference,
      transitionDedupeKey
    };

    if (current.entries.some((row) => row.transitionDedupeKey === transitionDedupeKey)) {
      return {
        history: current,
        appended: false,
        entry
      };
    }

    const next: CohortEscalationHistory = {
      cohortId: input.cohortId,
      entries: [...current.entries, entry].sort(compareEntries)
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');

    return {
      history: next,
      appended: true,
      entry
    };
  }

  function writeStatus(input: { cohortId: string; projection: CohortEscalationProjection }): string {
    ensureCohortEscalationArtifactDir({
      cohortId: input.cohortId,
      rootDir: options.cohortArtifactsRoot
    });

    const paths = resolveCohortEscalationArtifactPaths({
      cohortId: input.cohortId,
      rootDir: options.cohortArtifactsRoot
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(input.projection)}\n`, 'utf8');
    return paths.statusJsonPath;
  }

  return {
    load,
    appendTransition,
    writeStatus
  };
}

export type CohortEscalationHistoryStore = ReturnType<typeof createCohortEscalationHistoryStore>;
