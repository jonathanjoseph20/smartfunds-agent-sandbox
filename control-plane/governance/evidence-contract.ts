import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';
import type { ExecutionMode } from '../teams/types.ts';
import { normalizeChangedFiles } from './changed-files.ts';
import { isTier, type Tier } from './diagnostics.ts';
import { validateEvidenceShape } from './evidence-schema.ts';

export const EVIDENCE_JSON_PATH = 'governance/evidence.json';
export const EVIDENCE_SCHEMA_PATH = 'governance/schema/evidence.schema.json';

type SchemaType = 'object' | 'array' | 'string' | 'number' | 'boolean';

type SchemaNode = {
  type?: SchemaType;
  required?: string[];
  additionalProperties?: boolean;
  enum?: string[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
};

export type EvidenceMode = 'structured' | 'autonomous';

export type GovernanceEvidence = {
  tier: Tier;
  mode: EvidenceMode;
  affectedPaths: string[];
  determinismStatement: string;
  retrySemanticsModified: boolean;
  autonomyScopeExpanded: boolean;
  notes?: string;
  railImpacted?: boolean;
  entityRegistryImpacted?: boolean;
};

type Reader = (filePath: string) => string;
type Exists = (filePath: string) => boolean;

type ReadEvidenceContractOptions = {
  evidencePath?: string;
  schemaPath?: string;
  readFile?: Reader;
  existsSync?: Exists;
  enforceCanonical?: boolean;
};

type ReadEvidenceContractResult =
  | {
      exists: false;
      errors: string[];
    }
  | {
      exists: true;
      evidence: GovernanceEvidence;
      errors: [];
    }
  | {
      exists: true;
      errors: string[];
    };

function defaultReadFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function defaultExistsSync(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function sortKeys(value: Record<string, unknown>): string[] {
  return Object.keys(value).sort((left, right) => left.localeCompare(right));
}

function validateType(value: unknown, type: SchemaType): boolean {
  if (type === 'array') {
    return Array.isArray(value);
  }
  if (type === 'object') {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
  return typeof value === type;
}

function validateAgainstSchemaNode(value: unknown, schema: SchemaNode, currentPath: string): string[] {
  const errors: string[] = [];

  if (schema.type && !validateType(value, schema.type)) {
    errors.push(`${currentPath} must be type ${schema.type}.`);
    return errors;
  }

  if (schema.enum && !schema.enum.includes(String(value))) {
    errors.push(`${currentPath} must be one of: ${schema.enum.join(', ')}.`);
  }

  if (schema.type === 'array' && schema.items && Array.isArray(value)) {
    if (value.length === 0) {
      errors.push(`${currentPath} must not be empty.`);
    }
    for (let index = 0; index < value.length; index += 1) {
      const itemPath = `${currentPath}[${index}]`;
      errors.push(...validateAgainstSchemaNode(value[index], schema.items, itemPath));
    }
  }

  if (schema.type === 'object' && schema.properties && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const required = schema.required ?? [];
    for (const requiredKey of required) {
      if (!Object.hasOwn(record, requiredKey)) {
        errors.push(`${currentPath}.${requiredKey} is required.`);
      }
    }

    if (schema.additionalProperties === false) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(record)) {
        if (!allowed.has(key)) {
          errors.push(`${currentPath}.${key} is not allowed.`);
        }
      }
    }

    const propertyEntries = Object.entries(schema.properties).sort(([left], [right]) => left.localeCompare(right));
    for (const [key, propertySchema] of propertyEntries) {
      if (!Object.hasOwn(record, key)) {
        continue;
      }
      errors.push(...validateAgainstSchemaNode(record[key], propertySchema, `${currentPath}.${key}`));
    }
  }

  return errors;
}

function parseSchema(schemaRaw: string): SchemaNode {
  const parsed = JSON.parse(schemaRaw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('governance/schema/evidence.schema.json must be a JSON object.');
  }
  return parsed as SchemaNode;
}

function isSorted(values: string[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (values[index - 1].localeCompare(values[index]) > 0) {
      return false;
    }
  }
  return true;
}

function collectStringHygieneErrors(value: unknown, currentPath: string): string[] {
  const errors: string[] = [];
  if (typeof value === 'string') {
    if (/[ \t]+$/.test(value)) {
      errors.push(`${currentPath} must not have trailing whitespace.`);
    }
    return errors;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      errors.push(...collectStringHygieneErrors(value[index], `${currentPath}[${index}]`));
    }
    return errors;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const key of sortKeys(record)) {
      errors.push(...collectStringHygieneErrors(record[key], `${currentPath}.${key}`));
    }
  }

  return errors;
}

function normalizeEvidence(record: Record<string, unknown>): GovernanceEvidence | null {
  const tier = record.tier;
  const mode = record.mode;
  const affectedPaths = record.affectedPaths;
  const determinismStatement = record.determinismStatement;
  const retrySemanticsModified = record.retrySemanticsModified;
  const autonomyScopeExpanded = record.autonomyScopeExpanded;

  if (
    !isTier(tier) ||
    (mode !== 'structured' && mode !== 'autonomous') ||
    !Array.isArray(affectedPaths) ||
    !affectedPaths.every((entry) => typeof entry === 'string') ||
    affectedPaths.length === 0 ||
    !isSorted(affectedPaths) ||
    typeof determinismStatement !== 'string' ||
    typeof retrySemanticsModified !== 'boolean' ||
    typeof autonomyScopeExpanded !== 'boolean'
  ) {
    return null;
  }

  const normalized: GovernanceEvidence = {
    tier,
    mode,
    affectedPaths: [...affectedPaths],
    determinismStatement,
    retrySemanticsModified,
    autonomyScopeExpanded
  };

  if (typeof record.notes === 'string') {
    normalized.notes = record.notes;
  }
  if (typeof record.railImpacted === 'boolean') {
    normalized.railImpacted = record.railImpacted;
  }
  if (typeof record.entityRegistryImpacted === 'boolean') {
    normalized.entityRegistryImpacted = record.entityRegistryImpacted;
  }

  return normalized;
}

export function readEvidenceContract(options: ReadEvidenceContractOptions = {}): ReadEvidenceContractResult {
  const evidencePath = options.evidencePath ?? EVIDENCE_JSON_PATH;
  const schemaPath = options.schemaPath ?? EVIDENCE_SCHEMA_PATH;
  const readFile = options.readFile ?? defaultReadFile;
  const existsSync = options.existsSync ?? defaultExistsSync;
  const enforceCanonical = options.enforceCanonical ?? true;

  if (!existsSync(evidencePath)) {
    return {
      exists: false,
      errors: ['Missing governance/evidence.json']
    };
  }

  let evidenceRaw: string;
  let schemaRaw: string;
  try {
    evidenceRaw = readFile(evidencePath);
  } catch (error) {
    return {
      exists: true,
      errors: [`Unable to read ${evidencePath}: ${(error as Error).message}`]
    };
  }
  try {
    schemaRaw = readFile(schemaPath);
  } catch (error) {
    return {
      exists: true,
      errors: [`Unable to read ${schemaPath}: ${(error as Error).message}`]
    };
  }

  let evidenceValue: unknown;
  let schema: SchemaNode;
  try {
    evidenceValue = JSON.parse(evidenceRaw) as unknown;
  } catch (error) {
    return {
      exists: true,
      errors: [`${evidencePath} is not valid JSON: ${(error as Error).message}`]
    };
  }
  try {
    schema = parseSchema(schemaRaw);
  } catch (error) {
    return {
      exists: true,
      errors: [(error as Error).message]
    };
  }

  if (evidenceRaw.includes('\r')) {
    return {
      exists: true,
      errors: [`${evidencePath} must use LF line endings only.`]
    };
  }

  const shapeErrors = validateEvidenceShape(evidenceValue);
  if (shapeErrors.length > 0) {
    return {
      exists: true,
      errors: shapeErrors
    };
  }

  const schemaErrors = validateAgainstSchemaNode(evidenceValue, schema, 'evidence');
  const hygieneErrors = collectStringHygieneErrors(evidenceValue, 'evidence');
  if (schemaErrors.length > 0 || hygieneErrors.length > 0) {
    return {
      exists: true,
      errors: [...schemaErrors, ...hygieneErrors].sort((left, right) => left.localeCompare(right))
    };
  }

  const normalized = normalizeEvidence(evidenceValue as Record<string, unknown>);
  if (!normalized) {
    return {
      exists: true,
      errors: ['governance/evidence.json contains invalid values after schema validation. Ensure affectedPaths is sorted and non-empty.']
    };
  }

  const parsedForCanonical = JSON.parse(canonicalStringify(evidenceValue)) as GovernanceEvidence;
  const canonical = stringifyEvidenceJson(parsedForCanonical);
  if (enforceCanonical && evidenceRaw !== canonical) {
    return {
      exists: true,
      errors: ['Evidence drift detected. Run: npm run governance:emit']
    };
  }

  return {
    exists: true,
    evidence: normalized,
    errors: []
  };
}

export function resolveImpliedExecutionMode(
  executionModesTouched: ExecutionMode[]
): EvidenceMode | null {

  const uniqueModes = Array.from(new Set(executionModesTouched));

  // Safe default: no signal -> structured
  if (uniqueModes.length === 0) {
    return 'structured';
  }

  // If structured is touched at all, force structured.
  if (uniqueModes.includes('structured')) {
    return 'structured';
  }

  // Only autonomous present
  if (uniqueModes.includes('autonomous')) {
    return 'autonomous';
  }

  // Fallback safety
  return 'structured';
}

export function validateEvidenceAgainstComputedState(params: {
  evidence: GovernanceEvidence;
  changedFiles: string[];
  labelTier: Tier | null;
  impliedMode: EvidenceMode | null;
}): string[] {
  const errors: string[] = [];
  const changed = [...normalizeChangedFiles(params.changedFiles)].sort((left, right) => left.localeCompare(right));
  const evidencePaths = [...params.evidence.affectedPaths].sort((left, right) => left.localeCompare(right));

  if (params.labelTier !== null && params.evidence.tier !== params.labelTier) {
    errors.push(
      `Risk tier mismatch: label tier is ${params.labelTier}; governance/evidence.json tier must be ${params.labelTier}.`
    );
  }

  if (params.impliedMode !== null && params.evidence.mode !== params.impliedMode) {
    errors.push(
      `Execution mode mismatch: implied mode is ${params.impliedMode}; governance/evidence.json mode must be ${params.impliedMode}.`
    );
  }

  const changedCanonical = canonicalStringify(changed);
  const evidenceCanonical = canonicalStringify(evidencePaths);
  if (changedCanonical !== evidenceCanonical) {
    errors.push(
      `Affected paths mismatch: governance/evidence.json must exactly match changed files. expected=${canonicalStringify(changed)} actual=${canonicalStringify(evidencePaths)}`
    );
  }

  return errors.sort((left, right) => left.localeCompare(right));
}

type EvidenceWriteInput = {
  tier: Tier;
  mode: EvidenceMode;
  affectedPaths: string[];
  determinismStatement: string;
  retrySemanticsModified: boolean;
  autonomyScopeExpanded: boolean;
  notes?: string;
  railImpacted?: boolean;
  entityRegistryImpacted?: boolean;
};

export function buildCanonicalEvidence(input: EvidenceWriteInput): GovernanceEvidence {
  const base: GovernanceEvidence = {
    tier: input.tier,
    mode: input.mode,
    affectedPaths: normalizeChangedFiles(input.affectedPaths),
    determinismStatement: input.determinismStatement,
    retrySemanticsModified: input.retrySemanticsModified,
    autonomyScopeExpanded: input.autonomyScopeExpanded
  };
  if (input.notes !== undefined) {
    base.notes = input.notes;
  }
  if (input.railImpacted !== undefined) {
    base.railImpacted = input.railImpacted;
  }
  if (input.entityRegistryImpacted !== undefined) {
    base.entityRegistryImpacted = input.entityRegistryImpacted;
  }
  return base;
}

export function stringifyEvidenceJson(evidence: GovernanceEvidence): string {
  const ordered: Record<string, unknown> = {
    tier: evidence.tier,
    mode: evidence.mode,
    affectedPaths: normalizeChangedFiles(evidence.affectedPaths),
    determinismStatement: evidence.determinismStatement,
    retrySemanticsModified: evidence.retrySemanticsModified,
    autonomyScopeExpanded: evidence.autonomyScopeExpanded
  };

  if (evidence.notes !== undefined) {
    ordered.notes = evidence.notes;
  }
  if (evidence.railImpacted !== undefined) {
    ordered.railImpacted = evidence.railImpacted;
  }
  if (evidence.entityRegistryImpacted !== undefined) {
    ordered.entityRegistryImpacted = evidence.entityRegistryImpacted;
  }

  const stableObject = JSON.parse(canonicalStringify(ordered)) as Record<string, unknown>;
  return `${JSON.stringify(stableObject, null, 2).replace(/\r\n?/g, '\n')}\n`;
}

export function renderEvidenceSummaryMarkdown(evidence: GovernanceEvidence): string {
  const lines: string[] = [];
  lines.push('### Governance Evidence (Informational)');
  lines.push('');
  lines.push(`- Tier: ${evidence.tier}`);
  lines.push(`- Mode: ${evidence.mode}`);
  lines.push(`- Retry Semantics Modified: ${String(evidence.retrySemanticsModified)}`);
  lines.push(`- Autonomy Scope Expanded: ${String(evidence.autonomyScopeExpanded)}`);
  if (evidence.railImpacted !== undefined) {
    lines.push(`- Rail Impacted: ${String(evidence.railImpacted)}`);
  }
  if (evidence.entityRegistryImpacted !== undefined) {
    lines.push(`- Entity Registry Impacted: ${String(evidence.entityRegistryImpacted)}`);
  }
  lines.push(`- Determinism Statement: ${evidence.determinismStatement}`);
  if (evidence.notes !== undefined) {
    lines.push(`- Notes: ${evidence.notes}`);
  }
  lines.push('- Affected Paths:');
  for (const filePath of normalizeChangedFiles(evidence.affectedPaths)) {
    lines.push(`  - ${filePath}`);
  }
  return `${lines.join('\n').replace(/\r\n?/g, '\n')}\n`;
}

export function resolveEvidencePath(filePath?: string): string {
  const selected = filePath ?? EVIDENCE_JSON_PATH;
  return path.resolve(selected);
}
