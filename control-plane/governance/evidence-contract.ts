import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

export const EVIDENCE_JSON_PATH = 'governance/evidence.json';

export type EvidenceMode = 'structured' | 'autonomous';

export type GovernanceEvidence = {
  tier: 0 | 1 | 2 | 3;
  mode: EvidenceMode;
  affectedPaths: string[];
  determinismStatement: string;
  retrySemanticsModified: boolean;
  autonomyScopeExpanded: boolean;
  notes?: string;
  railImpacted?: boolean;
  entityRegistryImpacted?: boolean;
};

type ReadEvidenceOptions = {
  evidencePath?: string;
  schemaPath?: string;
  existsSync?: (filePath: string) => boolean;
  readFile?: (filePath: string) => string;
  enforceCanonical?: boolean;
};

export type EvidenceContractReadResult =
  | { exists: false; errors: string[] }
  | { exists: true; errors: string[]; evidence: GovernanceEvidence };

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizePathEntry(entry: string): string {
  const trimmed = entry.trim();
  return trimmed.startsWith('./') ? trimmed.slice(2) : trimmed;
}

function normalizeAffectedPaths(paths: string[]): string[] {
  return sortedUnique(paths.map(normalizePathEntry).filter((entry) => entry.length > 0));
}

function isEvidenceMode(value: unknown): value is EvidenceMode {
  return value === 'structured' || value === 'autonomous';
}

function isTier(value: unknown): value is 0 | 1 | 2 | 3 {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

function ensureBoolean(value: unknown, field: string, errors: string[]): boolean {
  if (typeof value !== 'boolean') {
    errors.push(`${field} must be a boolean.`);
    return false;
  }
  return value;
}

function buildEvidence(raw: Record<string, unknown>, errors: string[]): GovernanceEvidence | null {
  const tier = raw.tier;
  if (!isTier(tier)) {
    errors.push('tier must be 0, 1, 2, or 3.');
  }

  const mode = raw.mode;
  if (!isEvidenceMode(mode)) {
    errors.push('mode must be structured or autonomous.');
  }

  const affectedPaths = raw.affectedPaths;
  if (!Array.isArray(affectedPaths) || !affectedPaths.every((value) => typeof value === 'string')) {
    errors.push('affectedPaths must be a string array.');
  }

  const determinismStatement = raw.determinismStatement;
  if (typeof determinismStatement !== 'string' || determinismStatement.trim().length === 0) {
    errors.push('determinismStatement must be a non-empty string.');
  }

  const retrySemanticsModified = ensureBoolean(raw.retrySemanticsModified, 'retrySemanticsModified', errors);
  const autonomyScopeExpanded = ensureBoolean(raw.autonomyScopeExpanded, 'autonomyScopeExpanded', errors);

  if (errors.length > 0) {
    return null;
  }

  return {
    tier,
    mode,
    affectedPaths: (affectedPaths as string[]).map((entry) => normalizePathEntry(entry)),
    determinismStatement: (determinismStatement as string).trim(),
    retrySemanticsModified,
    autonomyScopeExpanded,
    ...(typeof raw.notes === 'string' ? { notes: raw.notes } : {}),
    ...(typeof raw.railImpacted === 'boolean' ? { railImpacted: raw.railImpacted } : {}),
    ...(typeof raw.entityRegistryImpacted === 'boolean' ? { entityRegistryImpacted: raw.entityRegistryImpacted } : {})
  };
}

function validateCanonicalAffectedPaths(evidence: GovernanceEvidence, errors: string[]): void {
  const normalized = normalizeAffectedPaths(evidence.affectedPaths);
  if (normalized.length === 0 || canonicalStringify(normalized) !== canonicalStringify(evidence.affectedPaths)) {
    errors.push('Ensure affectedPaths is sorted and non-empty');
  }
}

export function resolveEvidencePath(filePath = EVIDENCE_JSON_PATH): string {
  return path.resolve(filePath);
}

export function buildCanonicalEvidence(input: GovernanceEvidence): GovernanceEvidence {
  const evidence: GovernanceEvidence = {
    tier: input.tier,
    mode: input.mode,
    affectedPaths: normalizeAffectedPaths(input.affectedPaths),
    determinismStatement: input.determinismStatement.trim(),
    retrySemanticsModified: input.retrySemanticsModified,
    autonomyScopeExpanded: input.autonomyScopeExpanded,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.railImpacted !== undefined ? { railImpacted: input.railImpacted } : {}),
    ...(input.entityRegistryImpacted !== undefined ? { entityRegistryImpacted: input.entityRegistryImpacted } : {})
  };

  const errors: string[] = [];
  validateCanonicalAffectedPaths(evidence, errors);
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }

  return evidence;
}

export function stringifyEvidenceJson(evidence: GovernanceEvidence): string {
  return `${canonicalStringify(buildCanonicalEvidence(evidence))}\n`;
}

export function readEvidenceContract(options: ReadEvidenceOptions = {}): EvidenceContractReadResult {
  const existsSync = options.existsSync ?? fs.existsSync;
  const readFile = options.readFile ?? ((filePath: string) => fs.readFileSync(filePath, 'utf8'));

  const evidencePath = options.evidencePath ?? EVIDENCE_JSON_PATH;
  if (!existsSync(evidencePath)) {
    return { exists: false, errors: ['Missing governance/evidence.json'] };
  }

  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFile(evidencePath)) as unknown;
  } catch {
    return { exists: true, errors: ['Invalid governance/evidence.json JSON format.'] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { exists: true, errors: ['governance/evidence.json must be a JSON object.'] };
  }

  const evidence = buildEvidence(parsed as Record<string, unknown>, errors);
  if (!evidence) {
    return { exists: true, errors };
  }

  if (options.enforceCanonical !== false) {
    validateCanonicalAffectedPaths(evidence, errors);
  }

  if (errors.length > 0) {
    return { exists: true, errors };
  }

  return { exists: true, errors: [], evidence };
}

export function resolveImpliedExecutionMode(modesTouched: readonly string[]): EvidenceMode | null {
  const unique = sortedUnique(modesTouched.map((mode) => mode.trim()).filter((mode) => mode.length > 0));
  if (unique.length !== 1) {
    return null;
  }

  return unique[0] === 'autonomous' ? 'autonomous' : 'structured';
}

export function validateEvidenceAgainstComputedState(input: {
  evidence: GovernanceEvidence;
  changedFiles: string[];
  labelTier: 0 | 1 | 2 | 3 | null;
  impliedMode: EvidenceMode | null;
}): string[] {
  const errors: string[] = [];

  if (input.labelTier !== null && input.evidence.tier !== input.labelTier) {
    errors.push(`governance/evidence.json tier must be ${input.labelTier}`);
  }

  const normalizedChanged = normalizeAffectedPaths(input.changedFiles);
  if (canonicalStringify(normalizedChanged) !== canonicalStringify(input.evidence.affectedPaths)) {
    errors.push('Affected paths mismatch: governance/evidence.json must exactly match changed files.');
  }

  if (input.impliedMode !== null && input.evidence.mode !== input.impliedMode) {
    errors.push(`governance/evidence.json mode must be ${input.impliedMode}`);
  }

  return errors;
}
