import { canonicalStringify, sha256 } from '../finance/determinism.ts';

type EngineeringPlanIdentityInput = {
  specId: string;
  architectureSummary: string;
  subsystems: string[];
  implementationPhases: string[];
  dependencies?: string[];
  integrationRequirements?: string[];
  testStrategy: string;
  constraints?: string[];
};

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .sort((left, right) => left.localeCompare(right));
}

function buildIdentityPayload(input: EngineeringPlanIdentityInput) {
  return {
    specId: normalizeString(input.specId),
    architectureSummary: normalizeString(input.architectureSummary),
    subsystems: normalizeStringArray(input.subsystems),
    implementationPhases: normalizeStringArray(input.implementationPhases),
    dependencies: normalizeStringArray(input.dependencies),
    integrationRequirements: normalizeStringArray(input.integrationRequirements),
    testStrategy: normalizeString(input.testStrategy),
    constraints: normalizeStringArray(input.constraints),
  };
}

export function deriveEngineeringPlanId(input: EngineeringPlanIdentityInput): string {
  return sha256(canonicalStringify(buildIdentityPayload(input)));
}
