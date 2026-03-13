import type { ProductSpecValidation } from './product-spec-types.ts';

type ProductSpecValidationInput = {
  name?: unknown;
  problem?: unknown;
  targetUser?: unknown;
  solution?: unknown;
  architectureSummary?: unknown;
  mvpScope?: unknown;
  constraints?: unknown;
  dependencies?: unknown;
  originMissionIds?: unknown;
};

function hasNonEmptyString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function detectDuplicateValues(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const value of values.map((entry) => entry.trim())) {
    if (value.length === 0) {
      continue;
    }
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }

  return Array.from(duplicates).sort((left, right) => left.localeCompare(right));
}

export function validateProductSpec(input: ProductSpecValidationInput): ProductSpecValidation {
  const missingFields: string[] = [];

  if (!hasNonEmptyString(input.name)) {
    missingFields.push('name');
  }
  if (!hasNonEmptyString(input.problem)) {
    missingFields.push('problem');
  }
  if (!hasNonEmptyString(input.targetUser)) {
    missingFields.push('targetUser');
  }
  if (!hasNonEmptyString(input.solution)) {
    missingFields.push('solution');
  }
  if (!hasNonEmptyString(input.mvpScope)) {
    missingFields.push('mvpScope');
  }

  const originMissionIds = toStringArray(input.originMissionIds)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (originMissionIds.length === 0) {
    missingFields.push('originMissionIds');
  }

  const constraintViolations: string[] = [];

  const rawOriginMissionIds = toStringArray(input.originMissionIds).map((entry) => entry.trim());
  if (rawOriginMissionIds.some((entry) => entry.length === 0)) {
    constraintViolations.push('originMissionIds_contains_empty_value');
  }

  const duplicateOriginMissionIds = detectDuplicateValues(rawOriginMissionIds);
  if (duplicateOriginMissionIds.length > 0) {
    constraintViolations.push('originMissionIds_contains_duplicates');
  }

  const constraints = toStringArray(input.constraints).map((entry) => entry.trim());
  if (constraints.some((entry) => entry.length === 0)) {
    constraintViolations.push('constraints_contains_empty_value');
  }

  const dependencies = toStringArray(input.dependencies).map((entry) => entry.trim());
  if (dependencies.some((entry) => entry.length === 0)) {
    constraintViolations.push('dependencies_contains_empty_value');
  }

  const warnings: string[] = [];
  if (!hasNonEmptyString(input.architectureSummary)) {
    warnings.push('architectureSummary_recommended');
  }
  if (!Array.isArray(input.constraints)) {
    warnings.push('constraints_recommended');
  }
  if (!Array.isArray(input.dependencies)) {
    warnings.push('dependencies_recommended');
  }

  const sortedMissing = [...missingFields].sort((left, right) => left.localeCompare(right));
  const sortedViolations = [...new Set(constraintViolations)].sort((left, right) => left.localeCompare(right));
  const sortedWarnings = [...new Set(warnings)].sort((left, right) => left.localeCompare(right));

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
