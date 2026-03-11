import fs from 'node:fs';

import { canonicalStringify } from '../../finance/determinism.ts';

import { ensureCohortProgramArtifactDir, resolveCohortProgramArtifactPaths } from './program-runtime-paths.ts';
import { CohortProgramError, type ProgramExecutionHistory, type ProgramExecutionHistoryEntry } from './program-types.ts';

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

function parseEntry(value: unknown): ProgramExecutionHistoryEntry {
  if (!isRecord(value)) {
    throw new CohortProgramError('COHORT_PROGRAM_INVALID_HISTORY', 'Program history entry must be an object.');
  }

  const evaluatedSlot = asString(value.evaluatedSlot);
  const logDate = asString(value.logDate);
  const lifecycleState = asString(value.lifecycleState) as ProgramExecutionHistoryEntry['lifecycleState'];

  if (!evaluatedSlot || !logDate || !lifecycleState) {
    throw new CohortProgramError('COHORT_PROGRAM_INVALID_HISTORY', 'Program history entry missing required fields.');
  }

  const matchedConditionKinds = asStringArray(value.matchedConditionKinds) as ProgramExecutionHistoryEntry['matchedConditionKinds'];
  const launches = Array.isArray(value.launches)
    ? value.launches
      .filter((entry) => isRecord(entry))
      .map((entry) => ({
        launchDedupeKey: String(entry.launchDedupeKey ?? ''),
        conditionKind: String(entry.conditionKind ?? '') as ProgramExecutionHistoryEntry['launches'][number]['conditionKind'],
        investigationTemplate: String(entry.investigationTemplate ?? ''),
        sourceSignalType: String(entry.sourceSignalType ?? ''),
        sourceSignalDedupeKey: String(entry.sourceSignalDedupeKey ?? ''),
        status: String(entry.status ?? '') as ProgramExecutionHistoryEntry['launches'][number]['status'],
        ...(typeof entry.investigationRunId === 'string' ? { investigationRunId: entry.investigationRunId } : {}),
        ...(typeof entry.note === 'string' ? { note: entry.note } : {})
      }))
      .sort((left, right) => {
        const keyCmp = left.launchDedupeKey.localeCompare(right.launchDedupeKey);
        if (keyCmp !== 0) {
          return keyCmp;
        }
        const templateCmp = left.investigationTemplate.localeCompare(right.investigationTemplate);
        if (templateCmp !== 0) {
          return templateCmp;
        }
        return left.conditionKind.localeCompare(right.conditionKind);
      })
    : [];

  return {
    evaluatedSlot,
    logDate,
    lifecycleState,
    matchedConditionKinds,
    launches
  };
}

function compareEntry(left: ProgramExecutionHistoryEntry, right: ProgramExecutionHistoryEntry): number {
  const slotCmp = right.evaluatedSlot.localeCompare(left.evaluatedSlot);
  if (slotCmp !== 0) {
    return slotCmp;
  }
  const dateCmp = right.logDate.localeCompare(left.logDate);
  if (dateCmp !== 0) {
    return dateCmp;
  }
  return left.lifecycleState.localeCompare(right.lifecycleState);
}

function readHistoryFile(filePath: string, fallback: ProgramExecutionHistory): ProgramExecutionHistory {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new CohortProgramError('COHORT_PROGRAM_INVALID_HISTORY', `Program history must be an object: ${filePath}`);
  }

  const cohortId = asString(parsed.cohortId);
  const programId = asString(parsed.programId);
  const entries = Array.isArray(parsed.entries) ? parsed.entries.map((entry) => parseEntry(entry)) : [];

  if (!cohortId || !programId) {
    throw new CohortProgramError('COHORT_PROGRAM_INVALID_HISTORY', `Program history missing cohortId/programId: ${filePath}`);
  }

  return {
    cohortId,
    programId,
    entries: entries.sort(compareEntry)
  };
}

export function createProgramHistoryStore(options: { cohortArtifactsRoot?: string } = {}) {
  function load(input: { cohortId: string; programId: string }): ProgramExecutionHistory {
    const paths = resolveCohortProgramArtifactPaths({
      cohortId: input.cohortId,
      programId: input.programId,
      rootDir: options.cohortArtifactsRoot
    });

    return readHistoryFile(paths.historyJsonPath, {
      cohortId: input.cohortId,
      programId: input.programId,
      entries: []
    });
  }

  function append(input: { cohortId: string; programId: string; entry: ProgramExecutionHistoryEntry }): ProgramExecutionHistory {
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

    const current = load({ cohortId: input.cohortId, programId: input.programId });
    const next: ProgramExecutionHistory = {
      cohortId: input.cohortId,
      programId: input.programId,
      entries: [...current.entries, input.entry].sort(compareEntry)
    };

    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(next)}\n`, 'utf8');
    return next;
  }

  return {
    load,
    append
  };
}

export type ProgramHistoryStore = ReturnType<typeof createProgramHistoryStore>;
