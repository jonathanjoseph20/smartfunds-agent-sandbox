import fs from 'node:fs';
import path from 'node:path';

import {
  COHORT_PROGRAM_CADENCES,
  COHORT_PROGRAM_LIFECYCLE_STATES,
  PROGRAM_LAUNCH_CONDITION_KINDS,
  CohortProgramError,
  type CohortProgramCadence,
  type CohortProgramDefinition,
  type CohortProgramLifecycleState,
  type ProgramLaunchCondition,
} from './program-types.ts';

export const DEFAULT_COHORT_PROGRAM_DEFINITIONS_DIR = 'control-plane/cohorts/programs/definitions';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function asCadence(value: unknown): CohortProgramCadence | null {
  const raw = asTrimmedString(value);
  if (!raw) {
    return null;
  }
  return COHORT_PROGRAM_CADENCES.includes(raw as CohortProgramCadence)
    ? raw as CohortProgramCadence
    : null;
}

function asLifecycleState(value: unknown): CohortProgramLifecycleState | null {
  const raw = asTrimmedString(value);
  if (!raw) {
    return null;
  }
  return COHORT_PROGRAM_LIFECYCLE_STATES.includes(raw as CohortProgramLifecycleState)
    ? raw as CohortProgramLifecycleState
    : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const rows = value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => entry !== null);

  if (rows.length !== value.length) {
    return null;
  }

  return [...rows].sort((left, right) => left.localeCompare(right));
}

function validateLaunchCondition(value: unknown, sourceLabel: string, index: number): ProgramLaunchCondition {
  if (!isRecord(value)) {
    throw new CohortProgramError(
      'COHORT_PROGRAM_INVALID_DEFINITION',
      `Cohort program definition ${sourceLabel} launchConditions[${String(index)}] must be an object.`
    );
  }

  const kindRaw = asTrimmedString(value.kind);
  if (!kindRaw || !PROGRAM_LAUNCH_CONDITION_KINDS.includes(kindRaw as ProgramLaunchCondition['kind'])) {
    throw new CohortProgramError(
      'COHORT_PROGRAM_INVALID_DEFINITION',
      `Cohort program definition ${sourceLabel} launchConditions[${String(index)}].kind must be one of ${PROGRAM_LAUNCH_CONDITION_KINDS.join(', ')}.`
    );
  }

  if (kindRaw === 'cadence') {
    return { kind: 'cadence' };
  }

  if (kindRaw === 'signal_type') {
    const signalType = asTrimmedString(value.signalType);
    if (!signalType) {
      throw new CohortProgramError(
        'COHORT_PROGRAM_INVALID_DEFINITION',
        `Cohort program definition ${sourceLabel} launchConditions[${String(index)}].signalType must be a non-empty string.`
      );
    }
    return {
      kind: 'signal_type',
      signalType
    };
  }

  const health = asTrimmedString(value.health);
  if (!health || (health !== 'degraded' && health !== 'conflicted' && health !== 'unstable')) {
    throw new CohortProgramError(
      'COHORT_PROGRAM_INVALID_DEFINITION',
      `Cohort program definition ${sourceLabel} launchConditions[${String(index)}].health must be one of degraded, conflicted, unstable.`
    );
  }

  return {
    kind: 'cohort_health',
    health
  };
}

function compareLaunchCondition(left: ProgramLaunchCondition, right: ProgramLaunchCondition): number {
  const kindCmp = left.kind.localeCompare(right.kind);
  if (kindCmp !== 0) {
    return kindCmp;
  }

  if (left.kind === 'signal_type' && right.kind === 'signal_type') {
    return left.signalType.localeCompare(right.signalType);
  }

  if (left.kind === 'cohort_health' && right.kind === 'cohort_health') {
    return left.health.localeCompare(right.health);
  }

  return 0;
}

export function validateCohortProgramDefinition(value: unknown, sourceLabel = '<inline>'): CohortProgramDefinition {
  if (!isRecord(value)) {
    throw new CohortProgramError('COHORT_PROGRAM_INVALID_DEFINITION', `Cohort program definition ${sourceLabel} must be an object.`);
  }

  const programId = asTrimmedString(value.programId);
  const cohortId = asTrimmedString(value.cohortId);
  const displayName = asTrimmedString(value.displayName);
  const description = asTrimmedString(value.description) ?? undefined;
  const cadence = asCadence(value.cadence);
  const enabled = asBoolean(value.enabled);
  const lifecycleState = asLifecycleState(value.lifecycleState);
  const investigationTemplates = asStringArray(value.investigationTemplates);

  if (!programId) {
    throw new CohortProgramError('COHORT_PROGRAM_INVALID_DEFINITION', `Cohort program definition ${sourceLabel} programId must be a non-empty string.`);
  }
  if (!cohortId) {
    throw new CohortProgramError('COHORT_PROGRAM_INVALID_DEFINITION', `Cohort program definition ${programId} cohortId must be a non-empty string.`);
  }
  if (!displayName) {
    throw new CohortProgramError('COHORT_PROGRAM_INVALID_DEFINITION', `Cohort program definition ${programId} displayName must be a non-empty string.`);
  }
  if (!cadence) {
    throw new CohortProgramError(
      'COHORT_PROGRAM_INVALID_DEFINITION',
      `Cohort program definition ${programId} cadence must be one of ${COHORT_PROGRAM_CADENCES.join(', ')}.`
    );
  }
  if (enabled === null) {
    throw new CohortProgramError('COHORT_PROGRAM_INVALID_DEFINITION', `Cohort program definition ${programId} enabled must be a boolean.`);
  }
  if (!lifecycleState) {
    throw new CohortProgramError(
      'COHORT_PROGRAM_INVALID_DEFINITION',
      `Cohort program definition ${programId} lifecycleState must be one of ${COHORT_PROGRAM_LIFECYCLE_STATES.join(', ')}.`
    );
  }
  if (!investigationTemplates || investigationTemplates.length === 0) {
    throw new CohortProgramError(
      'COHORT_PROGRAM_INVALID_DEFINITION',
      `Cohort program definition ${programId} investigationTemplates must be a non-empty string array.`
    );
  }
  if (!Array.isArray(value.launchConditions) || value.launchConditions.length === 0) {
    throw new CohortProgramError(
      'COHORT_PROGRAM_INVALID_DEFINITION',
      `Cohort program definition ${programId} launchConditions must be a non-empty array.`
    );
  }

  const launchConditions = value.launchConditions
    .map((entry, index) => validateLaunchCondition(entry, sourceLabel, index))
    .sort(compareLaunchCondition);

  return {
    programId,
    cohortId,
    displayName,
    ...(description ? { description } : {}),
    cadence,
    enabled,
    lifecycleState,
    investigationTemplates,
    launchConditions
  };
}

export function loadCohortProgramDefinitions(options: { definitionsDir?: string } = {}): CohortProgramDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_COHORT_PROGRAM_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new CohortProgramError('COHORT_PROGRAM_DEFINITIONS_NOT_FOUND', `Cohort program definitions directory not found: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => {
      const parsed = JSON.parse(fs.readFileSync(path.join(definitionsDir, entry), 'utf8')) as unknown;
      return validateCohortProgramDefinition(parsed, entry);
    })
    .sort((left, right) => left.programId.localeCompare(right.programId));
}

export function createCohortProgramRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadCohortProgramDefinitions({ definitionsDir: options.definitionsDir });
  const byProgramId = new Map<string, CohortProgramDefinition>();

  for (const definition of definitions) {
    if (byProgramId.has(definition.programId)) {
      throw new CohortProgramError('COHORT_PROGRAM_DUPLICATE_DEFINITION', `Duplicate programId detected: ${definition.programId}`);
    }
    byProgramId.set(definition.programId, definition);
  }

  function getProgram(programId: string): CohortProgramDefinition {
    const found = byProgramId.get(programId);
    if (!found) {
      throw new CohortProgramError('COHORT_PROGRAM_NOT_FOUND', `Cohort program definition not found: ${programId}`);
    }
    return found;
  }

  function listPrograms(input: { cohortId?: string } = {}): CohortProgramDefinition[] {
    return Array.from(byProgramId.values())
      .filter((entry) => (input.cohortId ? entry.cohortId === input.cohortId : true))
      .sort((left, right) => left.programId.localeCompare(right.programId));
  }

  return {
    getProgram,
    listPrograms
  };
}

export type CohortProgramRegistry = ReturnType<typeof createCohortProgramRegistry>;
