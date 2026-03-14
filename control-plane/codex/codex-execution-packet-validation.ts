import type {
  CodexExecutionPacket,
  CodexExecutionPacketValidationResult,
} from './codex-execution-packet-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function validateCodexExecutionPacket(input: {
  packet: Partial<CodexExecutionPacket>;
  validTaskIds: Iterable<string>;
}): CodexExecutionPacketValidationResult {
  const missingFields: string[] = [];
  const constraintViolations: string[] = [];
  const warnings: string[] = [];

  if (!hasNonEmptyString(input.packet.promptTemplate)) {
    missingFields.push('promptTemplate');
  }

  const expectedArtifacts = asStringArray(input.packet.expectedArtifacts);
  if (expectedArtifacts.length === 0) {
    missingFields.push('expectedArtifacts');
  }

  const validationRules = asStringArray(input.packet.validationRules);
  if (validationRules.length === 0) {
    missingFields.push('validationRules');
  }

  const dependencies = asStringArray(input.packet.dependencies);
  const validTaskIdSet = new Set(Array.from(input.validTaskIds).sort((left, right) => left.localeCompare(right)));

  for (const dependency of dependencies.sort((left, right) => left.localeCompare(right))) {
    if (!validTaskIdSet.has(dependency)) {
      constraintViolations.push(`invalid_dependency_reference:${dependency}`);
    }
  }

  if (dependencies.length > 0 && !Array.isArray(input.packet.dependencies)) {
    warnings.push('dependencies_normalized_from_non_array');
  }

  const sortedMissing = uniqueSorted(missingFields);
  const sortedViolations = uniqueSorted(constraintViolations);
  const sortedWarnings = uniqueSorted(warnings);

  if (sortedMissing.length > 0) {
    return {
      validationState: 'incomplete',
      missingFields: sortedMissing,
      constraintViolations: sortedViolations,
      warnings: sortedWarnings,
    };
  }

  if (sortedViolations.length > 0) {
    return {
      validationState: 'invalid',
      missingFields: sortedMissing,
      constraintViolations: sortedViolations,
      warnings: sortedWarnings,
    };
  }

  return {
    validationState: 'valid',
    missingFields: sortedMissing,
    constraintViolations: sortedViolations,
    warnings: sortedWarnings,
  };
}
