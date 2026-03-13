import { canonicalStringify, sha256 } from '../finance/determinism.ts';

type ProductSpecIdentityInput = {
  name: string;
  problem: string;
  targetUser: string;
  solution: string;
  architectureSummary?: string;
  mvpScope: string;
  constraints?: string[];
  dependencies?: string[];
  originMissionIds: string[];
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

function buildIdentityPayload(input: ProductSpecIdentityInput) {
  return {
    name: normalizeString(input.name),
    problem: normalizeString(input.problem),
    targetUser: normalizeString(input.targetUser),
    solution: normalizeString(input.solution),
    architectureSummary: normalizeString(input.architectureSummary),
    mvpScope: normalizeString(input.mvpScope),
    constraints: normalizeStringArray(input.constraints),
    dependencies: normalizeStringArray(input.dependencies),
    originMissionIds: normalizeStringArray(input.originMissionIds),
  };
}

export function deriveProductSpecId(input: ProductSpecIdentityInput): string {
  return sha256(canonicalStringify(buildIdentityPayload(input)));
}
