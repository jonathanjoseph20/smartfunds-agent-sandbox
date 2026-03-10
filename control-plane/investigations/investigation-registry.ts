import fs from 'node:fs';
import path from 'node:path';

import {
  INVESTIGATION_PHASE_KINDS,
  INVESTIGATION_PHASE_EXECUTION_MODES,
  INVESTIGATION_RETRY_POLICIES,
  InvestigationError,
  type InvestigationDefinition,
  type InvestigationPhaseDefinition,
  type InvestigationPhaseKind
} from './investigation-types.ts';
import { WAIT_CONDITIONS } from './investigation-lifecycle.ts';

export const DEFAULT_INVESTIGATION_DEFINITIONS_DIR = 'control-plane/investigations/definitions';

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

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalized = value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => entry !== null);

  return normalized.length === value.length ? normalized : null;
}

function validatePhaseDefinition(
  value: unknown,
  definitionId: string,
  index: number
): InvestigationPhaseDefinition {
  if (!isRecord(value)) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${definitionId} phase ${String(index)} must be an object.`
    );
  }

  const phaseId = asTrimmedString(value.phaseId);
  const kind = asTrimmedString(value.kind) as InvestigationPhaseKind | null;
  const missionId = asTrimmedString(value.missionId) ?? undefined;
  const workflowId = asTrimmedString(value.workflowId) ?? undefined;
  const requiredInputs = asStringArray(value.requiredInputs);
  const produces = asStringArray(value.produces);
  const executionMode = asTrimmedString(value.executionMode);
  const minDelaySlots = value.minDelaySlots;
  const waitCondition = asTrimmedString(value.waitCondition);
  const maxRetries = value.maxRetries;
  const retryPolicy = asTrimmedString(value.retryPolicy);

  if (!phaseId) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${definitionId} phase ${String(index)} phaseId must be a non-empty string.`
    );
  }
  if (!kind || !INVESTIGATION_PHASE_KINDS.includes(kind)) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${definitionId} phase ${phaseId} kind must be one of ${INVESTIGATION_PHASE_KINDS.join(', ')}.`
    );
  }
  if (!requiredInputs) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${definitionId} phase ${phaseId} requiredInputs must be an array of strings.`
    );
  }
  if (!produces) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${definitionId} phase ${phaseId} produces must be an array of strings.`
    );
  }
  if (executionMode && !INVESTIGATION_PHASE_EXECUTION_MODES.includes(executionMode as InvestigationPhaseDefinition['executionMode'])) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${definitionId} phase ${phaseId} executionMode must be one of ${INVESTIGATION_PHASE_EXECUTION_MODES.join(', ')}.`
    );
  }
  if (minDelaySlots !== undefined && (!Number.isInteger(minDelaySlots) || Number(minDelaySlots) < 0)) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${definitionId} phase ${phaseId} minDelaySlots must be a non-negative integer.`
    );
  }
  if (waitCondition && !WAIT_CONDITIONS.includes(waitCondition as InvestigationPhaseDefinition['waitCondition'])) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${definitionId} phase ${phaseId} waitCondition must be one of ${WAIT_CONDITIONS.join(', ')}.`
    );
  }
  if (maxRetries !== undefined && (!Number.isInteger(maxRetries) || Number(maxRetries) < 0)) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${definitionId} phase ${phaseId} maxRetries must be a non-negative integer.`
    );
  }
  if (retryPolicy && !INVESTIGATION_RETRY_POLICIES.includes(retryPolicy as InvestigationPhaseDefinition['retryPolicy'])) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${definitionId} phase ${phaseId} retryPolicy must be one of ${INVESTIGATION_RETRY_POLICIES.join(', ')}.`
    );
  }

  return {
    phaseId,
    kind,
    ...(missionId ? { missionId } : {}),
    ...(workflowId ? { workflowId } : {}),
    requiredInputs,
    produces,
    ...(executionMode ? { executionMode: executionMode as InvestigationPhaseDefinition['executionMode'] } : {}),
    ...(minDelaySlots !== undefined ? { minDelaySlots: Number(minDelaySlots) } : {}),
    ...(waitCondition ? { waitCondition: waitCondition as InvestigationPhaseDefinition['waitCondition'] } : {}),
    ...(maxRetries !== undefined ? { maxRetries: Number(maxRetries) } : {}),
    ...(retryPolicy ? { retryPolicy: retryPolicy as InvestigationPhaseDefinition['retryPolicy'] } : {})
  };
}

export function validateInvestigationDefinition(
  value: unknown,
  sourceLabel = '<inline>'
): InvestigationDefinition {
  if (!isRecord(value)) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${sourceLabel} must be an object.`
    );
  }

  const investigationDefinitionId = asTrimmedString(value.investigationDefinitionId);
  const sourceSignalType = asTrimmedString(value.sourceSignalType) ?? undefined;
  const sourceTriggerId = asTrimmedString(value.sourceTriggerId) ?? undefined;
  const outputArtifacts = asStringArray(value.outputArtifacts);
  const completionCriteria = asStringArray(value.completionCriteria);
  const dedupeStrategy = asTrimmedString(value.dedupeStrategy);

  if (!investigationDefinitionId) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${sourceLabel} investigationDefinitionId must be a non-empty string.`
    );
  }
  if (!sourceSignalType && !sourceTriggerId) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${investigationDefinitionId} must declare sourceSignalType and/or sourceTriggerId.`
    );
  }
  if (!Array.isArray(value.phases) || value.phases.length === 0) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${investigationDefinitionId} phases must be a non-empty array.`
    );
  }
  if (!outputArtifacts) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${investigationDefinitionId} outputArtifacts must be an array of strings.`
    );
  }
  if (!completionCriteria) {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${investigationDefinitionId} completionCriteria must be an array of strings.`
    );
  }
  if (dedupeStrategy !== 'definition_signal_slot') {
    throw new InvestigationError(
      'INVESTIGATION_INVALID_DEFINITION',
      `Investigation definition ${investigationDefinitionId} dedupeStrategy must be definition_signal_slot.`
    );
  }

  const phases = value.phases.map((phase, index) => validatePhaseDefinition(phase, investigationDefinitionId, index));
  const phaseIds = new Set<string>();

  for (const [index, phase] of phases.entries()) {
    if (phaseIds.has(phase.phaseId)) {
      throw new InvestigationError(
        'INVESTIGATION_INVALID_DEFINITION',
        `Investigation definition ${investigationDefinitionId} contains duplicate phaseId ${phase.phaseId}.`
      );
    }
    phaseIds.add(phase.phaseId);
    if (phase.kind !== INVESTIGATION_PHASE_KINDS[index]) {
      throw new InvestigationError(
        'INVESTIGATION_INVALID_DEFINITION',
        `Investigation definition ${investigationDefinitionId} phases must follow ${INVESTIGATION_PHASE_KINDS.join(' -> ')}.`
      );
    }
  }

  return {
    investigationDefinitionId,
    ...(sourceSignalType ? { sourceSignalType } : {}),
    ...(sourceTriggerId ? { sourceTriggerId } : {}),
    phases,
    outputArtifacts,
    completionCriteria,
    dedupeStrategy: 'definition_signal_slot'
  };
}

export function loadInvestigationDefinitions(options: { definitionsDir?: string } = {}): InvestigationDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_INVESTIGATION_DEFINITIONS_DIR);

  if (!fs.existsSync(definitionsDir)) {
    throw new InvestigationError(
      'INVESTIGATION_DEFINITIONS_NOT_FOUND',
      `Investigation definitions directory not found: ${definitionsDir}`
    );
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  const definitions = files.map((entry) => {
    const filePath = path.join(definitionsDir, entry);
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    return validateInvestigationDefinition(parsed, entry);
  });

  return definitions.sort((left, right) => left.investigationDefinitionId.localeCompare(right.investigationDefinitionId));
}

export function createInvestigationRegistry(options: { definitionsDir?: string } = {}) {
  const definitions = loadInvestigationDefinitions({ definitionsDir: options.definitionsDir });
  const byDefinitionId = new Map<string, InvestigationDefinition>();

  for (const definition of definitions) {
    if (byDefinitionId.has(definition.investigationDefinitionId)) {
      throw new InvestigationError(
        'INVESTIGATION_DUPLICATE_DEFINITION',
        `Duplicate investigationDefinitionId detected: ${definition.investigationDefinitionId}`
      );
    }
    byDefinitionId.set(definition.investigationDefinitionId, definition);
  }

  function listInvestigations(): InvestigationDefinition[] {
    return Array.from(byDefinitionId.values())
      .sort((left, right) => left.investigationDefinitionId.localeCompare(right.investigationDefinitionId));
  }

  function getInvestigation(investigationDefinitionId: string): InvestigationDefinition {
    const found = byDefinitionId.get(investigationDefinitionId);
    if (!found) {
      throw new InvestigationError(
        'INVESTIGATION_NOT_FOUND',
        `Investigation definition not found: ${investigationDefinitionId}`
      );
    }
    return found;
  }

  function resolveInvestigation(input: {
    triggerId?: string;
    signalType?: string;
  }): InvestigationDefinition {
    const matched = listInvestigations().filter((definition) => {
      if (input.triggerId && definition.sourceTriggerId && definition.sourceTriggerId === input.triggerId) {
        return true;
      }
      if (input.signalType && definition.sourceSignalType && definition.sourceSignalType === input.signalType) {
        return true;
      }
      return false;
    });

    if (matched.length === 0) {
      throw new InvestigationError(
        'INVESTIGATION_NOT_FOUND',
        `No investigation definition found for triggerId=${input.triggerId ?? 'n/a'} signalType=${input.signalType ?? 'n/a'}.`
      );
    }

    return matched.sort((left, right) => left.investigationDefinitionId.localeCompare(right.investigationDefinitionId))[0];
  }

  return {
    listInvestigations,
    getInvestigation,
    resolveInvestigation
  };
}

export type InvestigationRegistry = ReturnType<typeof createInvestigationRegistry>;
