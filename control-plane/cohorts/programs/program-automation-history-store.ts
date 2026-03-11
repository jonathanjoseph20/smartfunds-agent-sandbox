import fs from 'node:fs';

import { canonicalStringify, sha256 } from '../../finance/determinism.ts';

import { ensureCohortProgramArtifactDir, resolveCohortProgramArtifactPaths } from './program-runtime-paths.ts';
import type { ProgramAutomationHistory, ProgramAutomationHistoryEntry } from './program-automation-types.ts';

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

function compareEntry(left: ProgramAutomationHistoryEntry, right: ProgramAutomationHistoryEntry): number {
  const slotCmp = right.slotOrSignalRef.localeCompare(left.slotOrSignalRef);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  return left.dedupeKey.localeCompare(right.dedupeKey);
}

function parseEntry(value: unknown): ProgramAutomationHistoryEntry {
  if (!isRecord(value)) {
    throw new Error('COHORT_PROGRAM_AUTOMATION_INVALID_HISTORY_ENTRY');
  }

  const programId = asString(value.programId);
  const cohortId = asString(value.cohortId);
  const slotOrSignalRef = asString(value.slotOrSignalRef);
  const evaluationOutcome = asString(value.evaluationOutcome) as ProgramAutomationHistoryEntry['evaluationOutcome'];
  const dedupeKey = asString(value.dedupeKey);

  if (!programId || !cohortId || !slotOrSignalRef || !evaluationOutcome || !dedupeKey) {
    throw new Error('COHORT_PROGRAM_AUTOMATION_INVALID_HISTORY_ENTRY');
  }

  return {
    programId,
    cohortId,
    slotOrSignalRef,
    evaluationOutcome,
    launched: value.launched === true,
    launchedInvestigationIds: asStringArray(value.launchedInvestigationIds),
    triggerReason: asStringArray(value.triggerReason),
    triggeringConditionTypes: asStringArray(value.triggeringConditionTypes),
    ...(asString(value.launchDedupeResult) ? { launchDedupeResult: asString(value.launchDedupeResult)! } : {}),
    dedupeKey
  };
}

function readHistoryFile(filePath: string, fallback: ProgramAutomationHistory): ProgramAutomationHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('COHORT_PROGRAM_AUTOMATION_INVALID_HISTORY');
  }

  const cohortId = asString(parsed.cohortId);
  const programId = asString(parsed.programId);
  if (!cohortId || !programId) {
    throw new Error('COHORT_PROGRAM_AUTOMATION_INVALID_HISTORY');
  }

  const entries = Array.isArray(parsed.entries) ? parsed.entries.map((entry) => parseEntry(entry)).sort(compareEntry) : [];

  return {
    cohortId,
    programId,
    entries
  };
}

export function computeProgramAutomationDedupeKey(input: {
  programId: string;
  cohortId: string;
  slotOrSignalRef: string;
  triggeringConditionTypes: string[];
  triggerReason: string[];
  evaluationOutcome: ProgramAutomationHistoryEntry['evaluationOutcome'];
}): string {
  return sha256(canonicalStringify({
    programId: input.programId,
    cohortId: input.cohortId,
    slotOrSignalRef: input.slotOrSignalRef,
    triggeringConditionTypes: [...input.triggeringConditionTypes].sort((left, right) => left.localeCompare(right)),
    triggerReason: [...input.triggerReason].sort((left, right) => left.localeCompare(right)),
    evaluationOutcome: input.evaluationOutcome
  }));
}

export function createProgramAutomationHistoryStore(options: { cohortArtifactsRoot?: string } = {}) {
  function load(input: { cohortId: string; programId: string }): ProgramAutomationHistory {
    const paths = resolveCohortProgramArtifactPaths({
      cohortId: input.cohortId,
      programId: input.programId,
      rootDir: options.cohortArtifactsRoot
    });

    return readHistoryFile(paths.automationHistoryJsonPath, {
      cohortId: input.cohortId,
      programId: input.programId,
      entries: []
    });
  }

  function append(input: { cohortId: string; programId: string; entry: Omit<ProgramAutomationHistoryEntry, 'dedupeKey'> }): {
    history: ProgramAutomationHistory;
    appended: boolean;
    entry: ProgramAutomationHistoryEntry;
  } {
    ensureCohortProgramArtifactDir({
      cohortId: input.cohortId,
      programId: input.programId,
      rootDir: options.cohortArtifactsRoot
    });

    const paths = resolveCohortProgramArtifactPaths({
      cohortId: input.cohortId,
      programId: input.programId,
      rootDir: options.cohortArtifactsRoot
    });

    const dedupeKey = computeProgramAutomationDedupeKey({
      programId: input.programId,
      cohortId: input.cohortId,
      slotOrSignalRef: input.entry.slotOrSignalRef,
      triggeringConditionTypes: input.entry.triggeringConditionTypes,
      triggerReason: input.entry.triggerReason,
      evaluationOutcome: input.entry.evaluationOutcome
    });

    const entry: ProgramAutomationHistoryEntry = {
      ...input.entry,
      dedupeKey
    };

    const current = load({ cohortId: input.cohortId, programId: input.programId });
    if (current.entries.some((row) => row.dedupeKey === dedupeKey)) {
      return {
        history: current,
        appended: false,
        entry
      };
    }

    const next: ProgramAutomationHistory = {
      cohortId: input.cohortId,
      programId: input.programId,
      entries: [...current.entries, entry].sort(compareEntry)
    };

    fs.writeFileSync(paths.automationHistoryJsonPath, `${canonicalStringify(next)}\n`, 'utf8');
    return {
      history: next,
      appended: true,
      entry
    };
  }

  function writeStatus(input: {
    cohortId: string;
    programId: string;
    status: Record<string, unknown>;
  }): string {
    ensureCohortProgramArtifactDir({
      cohortId: input.cohortId,
      programId: input.programId,
      rootDir: options.cohortArtifactsRoot
    });

    const paths = resolveCohortProgramArtifactPaths({
      cohortId: input.cohortId,
      programId: input.programId,
      rootDir: options.cohortArtifactsRoot
    });

    fs.writeFileSync(paths.automationStatusJsonPath, `${canonicalStringify(input.status)}\n`, 'utf8');
    return paths.automationStatusJsonPath;
  }

  return {
    load,
    append,
    writeStatus
  };
}

export type ProgramAutomationHistoryStore = ReturnType<typeof createProgramAutomationHistoryStore>;
