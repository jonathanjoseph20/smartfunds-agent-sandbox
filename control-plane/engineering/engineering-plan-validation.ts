import type { EngineeringPlanValidation } from './engineering-plan-types.ts';

type EngineeringPlanValidationInput = {
  specId?: unknown;
  architectureSummary?: unknown;
  subsystems?: unknown;
  implementationPhases?: unknown;
  dependencies?: unknown;
  integrationRequirements?: unknown;
  testStrategy?: unknown;
  constraints?: unknown;
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

export function validateEngineeringPlan(input: EngineeringPlanValidationInput): EngineeringPlanValidation {
  const missingFields: string[] = [];

  if (!hasNonEmptyString(input.specId)) {
    missingFields.push('specId');
  }
  if (!hasNonEmptyString(input.architectureSummary)) {
    missingFields.push('architectureSummary');
  }

  const subsystems = toStringArray(input.subsystems)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (subsystems.length === 0) {
    missingFields.push('subsystems');
  }

  const implementationPhases = toStringArray(input.implementationPhases)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  if (implementationPhases.length === 0) {
    missingFields.push('implementationPhases');
  }

  if (!hasNonEmptyString(input.testStrategy)) {
    missingFields.push('testStrategy');
  }

  const constraintViolations: string[] = [];

  const rawSubsystems = toStringArray(input.subsystems).map((entry) => entry.trim());
  if (rawSubsystems.some((entry) => entry.length === 0)) {
    constraintViolations.push('subsystems_contains_empty_value');
  }
  if (detectDuplicateValues(rawSubsystems).length > 0) {
    constraintViolations.push('subsystems_contains_duplicates');
  }

  const rawImplementationPhases = toStringArray(input.implementationPhases).map((entry) => entry.trim());
  if (rawImplementationPhases.some((entry) => entry.length === 0)) {
    constraintViolations.push('implementationPhases_contains_empty_value');
  }
  if (detectDuplicateValues(rawImplementationPhases).length > 0) {
    constraintViolations.push('implementationPhases_contains_duplicates');
  }

  const dependencies = toStringArray(input.dependencies).map((entry) => entry.trim());
  if (dependencies.some((entry) => entry.length === 0)) {
    constraintViolations.push('dependencies_contains_empty_value');
  }
  if (detectDuplicateValues(dependencies).length > 0) {
    constraintViolations.push('dependencies_contains_duplicates');
  }

  const integrationRequirements = toStringArray(input.integrationRequirements).map((entry) => entry.trim());
  if (integrationRequirements.some((entry) => entry.length === 0)) {
    constraintViolations.push('integrationRequirements_contains_empty_value');
  }
  if (detectDuplicateValues(integrationRequirements).length > 0) {
    constraintViolations.push('integrationRequirements_contains_duplicates');
  }

  const constraints = toStringArray(input.constraints).map((entry) => entry.trim());
  if (constraints.some((entry) => entry.length === 0)) {
    constraintViolations.push('constraints_contains_empty_value');
  }
  if (detectDuplicateValues(constraints).length > 0) {
    constraintViolations.push('constraints_contains_duplicates');
  }

  const warnings: string[] = [];
  if (!Array.isArray(input.dependencies)) {
    warnings.push('dependencies_recommended');
  }
  if (!Array.isArray(input.integrationRequirements)) {
    warnings.push('integrationRequirements_recommended');
  }
  if (!Array.isArray(input.constraints)) {
    warnings.push('constraints_recommended');
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
