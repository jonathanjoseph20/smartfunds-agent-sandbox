import fs from 'node:fs';

import type { RailProfile } from '../entities/rails.ts';
import type { EntityOwnershipStatus } from '../studio/entity-registry.ts';
import type { OwnershipStatus } from '../studio/ownership';
import type { ExecutionMode } from '../teams/types';
import type { RailBindingStatus, RailViolation } from './rail-binding.ts';
import { evaluateModePolicy, type ModeEnforcementStatus, type ModeViolation } from './mode-policy.ts';
import type { ModeBoundaryStatus } from '../studio/mode-boundary.ts';
import type { SwarmMode } from '../swarm/schema.ts';
import type { IsolationStatus, IsolationViolationCode } from '../isolation/types.ts';
import type { ProvenanceSource } from '../pr-body/types.ts';

export type Tier = 0 | 1 | 2 | 3;
export type TierString = '0' | '1' | '2' | '3';
export type GovernanceErrorSeverity = 'error' | 'warning';
export type GovernanceErrorCode =
  | 'MISSING_LABEL'
  | 'MISSING_TIER_LABEL'
  | 'INVALID_TIER_LABEL'
  | 'MISSING_EVIDENCE_BLOCK'
  | 'MISSING_EVIDENCE_FIELDS'
  | 'UNSUPPORTED_EVIDENCE_FIELDS'
  | 'EVIDENCE_FORMAT_ERROR'
  | 'TIER_MISMATCH'
  | 'OWNERSHIP_VIOLATION'
  | 'UNOWNED_PATHS'
  | 'AMBIGUOUS_OWNERSHIP'
  | 'MIXED_MODE'
  | 'SWARM_TOPOLOGY_VIOLATION'
  | 'RAIL_BINDING_VIOLATION'
  | 'EVIDENCE_IN_COMMENT_NOT_BODY';

export type GovernanceSuggestedFix = {
  action: string;
  details: string;
};

export type GovernanceError = {
  code: GovernanceErrorCode;
  severity: GovernanceErrorSeverity;
  retryable: boolean;
  message: string;
  suggestedFix: GovernanceSuggestedFix | null;
  sourceFields: string[];
};

export const TIER_LABELS = ['tier-0', 'tier-1', 'tier-2', 'tier-3'] as const;
export const TIER_VALUES = [0, 1, 2, 3] as const;
export const EVIDENCE_FIELDS = [
  'Risk Tier',
  'Justification',
  'Affected Paths',
  'Tests Added',
  'Determinism Statement'
] as const;
export const OPTIONAL_EVIDENCE_FIELDS = ['Swarm', 'Swarm Mode', 'Swarm Team'] as const;
const REQUIRED_TIER0_CHECK = 'lint_tier0';
const REQUIRED_TIER3_CHECK = 'tier3_label_gate';

export interface RiskContract {
  tiers: Record<TierString, { description: string; required_checks: string[] }>;
  paths: Record<string, Tier>;
  default_tier: Tier;
}

export interface PullRequestData {
  body: string;
  labels: string[];
  changedFiles: string[];
}

export interface ValidationResult {
  ok: boolean;
  tierLabel?: Tier;
  tierBodyLabel?: Tier;
  tierBody?: Tier;
  impliedTier: Tier;
  requiredChecks: string[];
  escalationFiles: string[];
  errors: string[];
  missingEvidenceFields: string[];
}

export type GovernanceReport = {
  declaredTier: number | null;
  impliedTier: number | null;
  labelTier: number | null;
  missingLabels: string[];
  missingEvidenceFields: string[];
  requiredChecks: string[];
  projectsTouched: string[];
  teamsTouched: string[];
  swarmsDeclared: string[];
  swarmsTouched: string[];
  swarmOrchestrationStatus: 'ok' | 'missing_registry' | 'invalid_graph' | 'violations';
  swarmOrchestrationViolations: string[];
  swarmDependencyEdges: Array<{ from: string; to: string }>;
  swarmTopologicalOrder: string[];
  swarmPhaseBySwarm: Record<string, string>;
  swarmCycleDetected?: string[];
  swarmWarnings: string[];
  swarmMode: SwarmMode | null;
  swarmTeamId: string | null;
  unownedFiles: string[];
  ownershipStatus: OwnershipStatus;
  entitiesTouched: string[];
  entityOwnershipStatus: EntityOwnershipStatus;
  unmappedProjects: string[];
  entityByProject: Record<string, string | null>;
  entityRailProfileByEntity: Record<string, RailProfile | null>;
  entitiesMissingRailProfile: string[];
  railBindingStatus: RailBindingStatus;
  railViolations: RailViolation[];
  autonomousContextDetected: boolean;
  branchNamespaceValid: boolean;
  structuredPathsTouched: string[];
  autonomousPathsTouched: string[];
  isolationStatus: IsolationStatus;
  isolationViolations: IsolationViolationCode[];
  nextActions: string[];
  warnings: string[];
  executionModesTouched: ExecutionMode[];
  modeBoundaryStatus: ModeBoundaryStatus;
  conflictingTeams: string[];
  conflictingPaths: string[];
  swarmExecutionModesTouched: ExecutionMode[];
  modeWarnings: string[];
  unownedPaths: string[];
  ambiguousPaths: string[];
  modeEnforcementStatus: ModeEnforcementStatus;
  modeViolation: ModeViolation;
  requiredMinimumTier: number | null;
  railProfilesTouched?: string[];
  errors: GovernanceError[];
  metadataSource: {
    bodySource: ProvenanceSource;
    bodyPath: string | null;
    labelSource: ProvenanceSource;
    labelsPath: string | null;
    commentSource: ProvenanceSource;
  };
  commentEvidenceDetected: boolean;
  commentEvidenceCount: number;
  sealWarnings: string[];
  executionContext: {
    context: 'local' | 'ci';
    executionMode: 'structured' | 'autonomous' | 'unknown';
    retryEnabled: boolean;
  };
  retryTrace: {
    attempted: boolean;
    retryCount: 0 | 1;
    initialStatus: 'passed' | 'failed';
    finalStatus: 'passed' | 'failed';
    triggerErrorCode: string | null;
    retryable: boolean;
    patchApplied: string | null;
  };
};

export function isTier(value: unknown): value is Tier {
  return typeof value === 'number' && TIER_VALUES.includes(value as Tier);
}

export function extractTierFromLabels(labels: string[]): Tier | undefined {
  const tiers = labels
    .map((label) => label.match(/^tier-([0-3])$/)?.[1])
    .filter((tier): tier is string => Boolean(tier));

  if (tiers.length === 0) {
    return undefined;
  }

  const unique = [...new Set(tiers)];
  if (unique.length > 1) {
    throw new Error(
      `Multiple tier labels detected (${unique
        .map((tier) => `tier-${tier}`)
        .join(', ')}). Keep exactly one of: ${TIER_LABELS.join(', ')}.`
    );
  }

  return Number.parseInt(unique[0], 10) as Tier;
}

export function parseEvidenceBlock(body: string): Record<string, string> | undefined {
  const match = body.match(/```evidence\s*([\s\S]*?)```/i);
  if (!match) {
    return undefined;
  }

  const parsed: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const separator = trimmed.indexOf(':');
    if (separator < 0) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    parsed[key] = value;
  }

  return parsed;
}

export function extractTierLabelFromBody(body: string): Tier | undefined {
  const outsideFences = body.replace(/```[\s\S]*?```/g, '');
  const matches = Array.from(outsideFences.matchAll(/\btier-([0-3])\b/gi)).map((match) => match[1]);

  if (matches.length === 0) {
    return undefined;
  }

  const unique = [...new Set(matches)];
  if (unique.length > 1) {
    throw new Error(
      `Multiple unfenced tier declarations detected in PR body (${unique
        .map((tier) => `tier-${tier}`)
        .join(', ')}). Keep exactly one unfenced tier-* declaration.`
    );
  }

  return Number.parseInt(unique[0], 10) as Tier;
}

export function extractTierFromEvidence(body: string): Tier | undefined {
  const evidence = parseEvidenceBlock(body);
  const tierValue = evidence?.['Risk Tier'];
  if (!tierValue) {
    return undefined;
  }

  const normalized = tierValue.trim().match(/^[0-3]$/)?.[0];
  if (!normalized) {
    return undefined;
  }

  return Number.parseInt(normalized, 10) as Tier;
}

export function validateEvidenceBlockSchema(body: string): {
  evidence?: Record<string, string>;
  errors: string[];
  missingFields: string[];
} {
  const match = body.match(/```evidence\s*([\s\S]*?)```/i);
  if (!match) {
    return {
      errors: [
        `Missing fenced evidence block. Paste:\n\n\`\`\`evidence\nRisk Tier: <0|1|2|3>\nJustification: <why this tier>\nAffected Paths: <comma-separated globs or file list>\nTests Added: <what you ran/added, or "N/A" with reason>\nDeterminism Statement: <why this change is deterministic and reproducible>\n\`\`\``
      ],
      missingFields: [...EVIDENCE_FIELDS]
    };
  }

  const errors: string[] = [];
  const parsed: Record<string, string> = {};

  for (const line of match[1].split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const separator = trimmed.indexOf(':');
    if (separator < 0) {
      errors.push(`Evidence block line must use \`Key: Value\` format: ${trimmed}`);
      continue;
    }

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim();
    if (
      !EVIDENCE_FIELDS.includes(key as (typeof EVIDENCE_FIELDS)[number]) &&
      !OPTIONAL_EVIDENCE_FIELDS.includes(key as (typeof OPTIONAL_EVIDENCE_FIELDS)[number])
    ) {
      errors.push(`Evidence block contains unsupported field: ${key}.`);
      continue;
    }
    if (key !== 'Swarm' && parsed[key]) {
      errors.push(`Evidence block contains duplicate field: ${key}.`);
      continue;
    }
    if (!value) {
      errors.push(`Evidence block field must not be empty: ${key}.`);
      continue;
    }
    parsed[key] = value;
  }

  const missingFields = EVIDENCE_FIELDS.filter((field) => !parsed[field]);
  if (missingFields.length > 0) {
    errors.push(`Evidence block is missing required field(s): ${missingFields.join(', ')}.`);
  }

  return {
    evidence: parsed,
    errors,
    missingFields
  };
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function globToRegExp(glob: string): RegExp {
  const escaped = escapeRegex(glob);
  const pattern = escaped
    .replace(/\*\*/g, '__DOUBLE_STAR__')
    .replace(/\*/g, '[^/]*')
    .replace(/__DOUBLE_STAR__/g, '.*');

  return new RegExp(`^${pattern}$`);
}

export function inferImpliedTier(changedFiles: string[], contract: RiskContract): {
  impliedTier: Tier;
  escalationFiles: string[];
} {
  let impliedTier: Tier = 0;
  let escalationFiles: string[] = [];

  const rules = Object.entries(contract.paths).map(([glob, tier]) => ({
    glob,
    tier,
    regex: globToRegExp(glob)
  }));

  for (const file of changedFiles) {
    let fileTier: Tier = 0;
    let matchedAnyRule = false;
    for (const rule of rules) {
      if (rule.regex.test(file)) {
        matchedAnyRule = true;
        if (rule.tier > fileTier) {
          fileTier = rule.tier;
        }
      }
    }
    if (!matchedAnyRule) {
      fileTier = contract.default_tier;
    }

    if (fileTier > impliedTier) {
      impliedTier = fileTier;
      escalationFiles = [file];
    } else if (fileTier === impliedTier && fileTier > 0) {
      escalationFiles.push(file);
    }
  }

  if (changedFiles.length === 0) {
    impliedTier = contract.default_tier;
  }

  return { impliedTier, escalationFiles };
}

export function getRequiredChecksForTier(tier: Tier, contract: RiskContract): string[] {
  return [...contract.tiers[String(tier) as TierString].required_checks];
}

export function assertValidRiskContract(contract: unknown): asserts contract is RiskContract {
  if (!contract || typeof contract !== 'object') {
    throw new Error('Invalid risk contract: root must be an object.');
  }

  const root = contract as Record<string, unknown>;
  const tiers = root.tiers;
  const paths = root.paths;
  const defaultTier = root.default_tier;

  if (!tiers || typeof tiers !== 'object' || Array.isArray(tiers)) {
    throw new Error('Invalid risk contract: `tiers` must be an object.');
  }
  if (!paths || typeof paths !== 'object' || Array.isArray(paths)) {
    throw new Error('Invalid risk contract: `paths` must be an object.');
  }
  if (!isTier(defaultTier)) {
    throw new Error('Invalid risk contract: `default_tier` must be 0, 1, 2, or 3.');
  }

  const tierEntries = tiers as Record<string, unknown>;
  for (const tier of TIER_VALUES) {
    const key = String(tier) as TierString;
    const tierDef = tierEntries[key];
    if (!tierDef || typeof tierDef !== 'object' || Array.isArray(tierDef)) {
      throw new Error(`Invalid risk contract: missing tier definition for ${key}.`);
    }

    const tierObj = tierDef as Record<string, unknown>;
    if (typeof tierObj.description !== 'string' || tierObj.description.trim() === '') {
      throw new Error(`Invalid risk contract: tier ${key} must include a non-empty description.`);
    }

    if (!Array.isArray(tierObj.required_checks) || !tierObj.required_checks.every((c) => typeof c === 'string' && c.trim())) {
      throw new Error(`Invalid risk contract: tier ${key} must include string array \`required_checks\`.`);
    }

    const checks = tierObj.required_checks as string[];
    if (!checks.includes(REQUIRED_TIER0_CHECK)) {
      throw new Error(`Invalid risk contract: tier ${key} must include ${REQUIRED_TIER0_CHECK}.`);
    }
    if (tier === 3 && !checks.includes(REQUIRED_TIER3_CHECK)) {
      throw new Error(`Invalid risk contract: tier 3 must include ${REQUIRED_TIER3_CHECK}.`);
    }
  }

  for (const [glob, tierValue] of Object.entries(paths as Record<string, unknown>)) {
    if (!glob || typeof glob !== 'string') {
      throw new Error('Invalid risk contract: path glob keys must be non-empty strings.');
    }
    if (!isTier(tierValue)) {
      throw new Error(`Invalid risk contract: path mapping for ${glob} must be tier 0-3.`);
    }
  }
}

export function validatePrData(pr: PullRequestData, contract: RiskContract): ValidationResult {
  assertValidRiskContract(contract);
  const errors: string[] = [];
  let tierLabel: Tier | undefined;
  let tierBodyLabel: Tier | undefined;

  try {
    tierLabel = extractTierFromLabels(pr.labels);
  } catch (error) {
    errors.push((error as Error).message);
  }

  try {
    tierBodyLabel = extractTierLabelFromBody(pr.body);
  } catch (error) {
    errors.push((error as Error).message);
  }

  const evidenceValidation = validateEvidenceBlockSchema(pr.body);
  const evidence = evidenceValidation.evidence;
  errors.push(...evidenceValidation.errors);
  const tierBody = extractTierFromEvidence(pr.body);
  const { impliedTier, escalationFiles } = inferImpliedTier(pr.changedFiles, contract);
  const requiredChecks = tierLabel !== undefined ? getRequiredChecksForTier(tierLabel, contract) : [];

  if (tierLabel === undefined) {
    errors.push(`Missing risk tier label. Add exactly one: ${TIER_LABELS.join(', ')}.`);
  }

  if (tierBodyLabel === undefined) {
    errors.push('Missing unfenced PR body tier declaration. Include exactly one plain-text `tier-0`..`tier-3` in the PR body.');
  }

  if (evidence && tierBody === undefined) {
    errors.push('Evidence block must include `Risk Tier: <0|1|2|3>`.');
  }

  if (tierLabel !== undefined && tierBodyLabel !== undefined && tierBodyLabel !== tierLabel) {
    errors.push(
      `Risk tier mismatch: labels are authoritative. Label tier is ${tierLabel}; update unfenced PR body declaration to tier-${tierLabel}.`
    );
  }

  if (tierLabel !== undefined && tierBody !== undefined && tierBody !== tierLabel) {
    errors.push(
      `Risk tier mismatch: labels are authoritative. Label tier is ${tierLabel}; update PR body evidence Risk Tier to ${tierLabel}.`
    );
  }

  if (tierLabel !== undefined && tierLabel < impliedTier) {
    errors.push(
      `Declared tier-${tierLabel} is below implied tier-${impliedTier}. Escalating files: ${escalationFiles.join(', ')}.`
    );
  }

  if (tierLabel === 3 && !pr.labels.includes('tier-3-approved')) {
    errors.push(
      'Tier 3 requires `tier-3-approved` label. Add it, and if CI still shows stale labels/body, push a new commit to refresh the PR payload.'
    );
  }

  return {
    ok: errors.length === 0,
    tierLabel,
    tierBodyLabel,
    tierBody,
    impliedTier,
    requiredChecks,
    escalationFiles,
    errors,
    missingEvidenceFields: evidenceValidation.missingFields
  };
}

export function loadRiskContract(contractPath = new URL('../risk-contract.json', import.meta.url).pathname): RiskContract {
  const parsed = JSON.parse(fs.readFileSync(contractPath, 'utf8')) as unknown;
  assertValidRiskContract(parsed);
  return parsed;
}

function sortedUnique<T extends string>(values: T[]): T[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b)) as T[];
}

function sortRecordByKey<T>(value: Record<string, T>): Record<string, T> {
  const sortedEntries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
  return Object.fromEntries(sortedEntries) as Record<string, T>;
}

function sortRailViolations(values: RailViolation[]): RailViolation[] {
  return [...values].sort((a, b) => {
    const typeCompare = a.type.localeCompare(b.type);
    if (typeCompare !== 0) {
      return typeCompare;
    }

    if (a.entityId && b.entityId) {
      const entityCompare = a.entityId.localeCompare(b.entityId);
      if (entityCompare !== 0) {
        return entityCompare;
      }
    } else if (a.entityId && !b.entityId) {
      return -1;
    } else if (!a.entityId && b.entityId) {
      return 1;
    }

    return a.details.localeCompare(b.details);
  });
}

function sortSwarmDependencyEdges(values: Array<{ from: string; to: string }>): Array<{ from: string; to: string }> {
  return [...values].sort((a, b) => {
    const fromCompare = a.from.localeCompare(b.from);
    if (fromCompare !== 0) {
      return fromCompare;
    }
    return a.to.localeCompare(b.to);
  });
}

function sortSourceFields(values: string[]): string[] {
  return sortedUnique(values);
}

function sortGovernanceErrors(values: GovernanceError[]): GovernanceError[] {
  return [...values].sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) {
      return codeCompare;
    }

    const severityCompare = a.severity.localeCompare(b.severity);
    if (severityCompare !== 0) {
      return severityCompare;
    }

    return a.message.localeCompare(b.message);
  });
}

function buildCanonicalGovernanceErrors(input: {
  declaredTier: number | null;
  impliedTier: number | null;
  missingLabels: string[];
  missingEvidenceFields: string[];
  ownershipStatus: OwnershipStatus;
  swarmOrchestrationStatus: 'ok' | 'missing_registry' | 'invalid_graph' | 'violations';
  railBindingStatus: RailBindingStatus;
  modeEnforcementStatus: ModeEnforcementStatus;
  modeViolation: ModeViolation;
  unownedPaths: string[];
}): GovernanceError[] {
  const errors: GovernanceError[] = [];
  const tierLabels = new Set(['tier-0', 'tier-1', 'tier-2', 'tier-3']);
  const sortedMissingEvidenceFields = sortedUnique(input.missingEvidenceFields);
  const sortedUnownedPaths = sortedUnique(input.unownedPaths);
  const missingTierLabel = input.missingLabels.some((label) => tierLabels.has(label));
  const missingNonTierLabels = input.missingLabels.filter((label) => !tierLabels.has(label));

  if (missingTierLabel) {
    errors.push({
      code: 'MISSING_TIER_LABEL',
      severity: 'error',
      retryable: true,
      message: 'Missing required tier label.',
      suggestedFix: {
        action: 'add_tier_label',
        details: 'Add exactly one tier label matching the declared or implied tier.'
      },
      sourceFields: ['missingLabels', 'declaredTier', 'impliedTier']
    });
  }

  if (missingNonTierLabels.length > 0) {
    errors.push({
      code: 'MISSING_LABEL',
      severity: 'error',
      retryable: true,
      message: `Missing required label(s): ${missingNonTierLabels.join(', ')}.`,
      suggestedFix: {
        action: 'add_missing_labels',
        details: 'Add missing governance labels without removing existing labels.'
      },
      sourceFields: ['missingLabels']
    });
  }

  if (sortedMissingEvidenceFields.length > 0) {
    const missingSet = new Set(sortedMissingEvidenceFields);
    const evidenceBlockMissing = EVIDENCE_FIELDS.every((field) => missingSet.has(field));
    errors.push({
      code: evidenceBlockMissing ? 'MISSING_EVIDENCE_BLOCK' : 'MISSING_EVIDENCE_FIELDS',
      severity: 'error',
      retryable: true,
      message: evidenceBlockMissing
        ? 'Missing required evidence block.'
        : `Evidence is missing required field(s): ${sortedMissingEvidenceFields.join(', ')}.`,
      suggestedFix: {
        action: 'patch_evidence_block',
        details: 'Ensure evidence block exists and includes all required fields in Key: Value format.'
      },
      sourceFields: ['missingEvidenceFields']
    });
  }

  if (
    input.declaredTier !== null &&
    input.impliedTier !== null &&
    input.declaredTier < input.impliedTier
  ) {
    errors.push({
      code: 'TIER_MISMATCH',
      severity: 'error',
      retryable: false,
      message: `Declared tier-${input.declaredTier} is below implied tier-${input.impliedTier}.`,
      suggestedFix: {
        action: 'align_tier',
        details: 'Raise declared tier and align metadata with implied tier.'
      },
      sourceFields: ['declaredTier', 'impliedTier']
    });
  }

  if (input.ownershipStatus === 'ambiguous_project_ownership') {
    errors.push({
      code: 'AMBIGUOUS_OWNERSHIP',
      severity: 'error',
      retryable: false,
      message: 'Ownership is ambiguous for one or more changed paths.',
      suggestedFix: {
        action: 'resolve_ownership',
        details: 'Clarify ownership mappings or split the change set.'
      },
      sourceFields: ['ownershipStatus']
    });
  } else if (input.ownershipStatus !== 'ok') {
    errors.push({
      code: 'OWNERSHIP_VIOLATION',
      severity: 'error',
      retryable: false,
      message: `Ownership status is ${input.ownershipStatus}.`,
      suggestedFix: {
        action: 'resolve_ownership',
        details: 'Address ownership diagnostics before retrying.'
      },
      sourceFields: ['ownershipStatus']
    });
  }

  if (sortedUnownedPaths.length > 0) {
    errors.push({
      code: 'UNOWNED_PATHS',
      severity: 'warning',
      retryable: false,
      message: `Unowned paths detected: ${sortedUnownedPaths.join(', ')}.`,
      suggestedFix: {
        action: 'assign_paths',
        details: 'Map unowned paths to owning teams or projects.'
      },
      sourceFields: ['unownedPaths']
    });
  }

  if (input.modeEnforcementStatus === 'failed' && input.modeViolation === 'mixed_execution_modes') {
    errors.push({
      code: 'MIXED_MODE',
      severity: 'error',
      retryable: false,
      message: 'Mixed execution modes detected.',
      suggestedFix: {
        action: 'split_execution_modes',
        details: 'Split PR by execution mode or adjust declared mode boundaries.'
      },
      sourceFields: ['modeEnforcementStatus', 'modeViolation']
    });
  }

  if (input.swarmOrchestrationStatus !== 'ok') {
    errors.push({
      code: 'SWARM_TOPOLOGY_VIOLATION',
      severity: 'error',
      retryable: false,
      message: `Swarm orchestration status is ${input.swarmOrchestrationStatus}.`,
      suggestedFix: {
        action: 'repair_swarm_topology',
        details: 'Fix swarm orchestration registry and dependency topology.'
      },
      sourceFields: ['swarmOrchestrationStatus']
    });
  }

  if (input.railBindingStatus !== 'ok') {
    errors.push({
      code: 'RAIL_BINDING_VIOLATION',
      severity: 'error',
      retryable: false,
      message: `Rail binding status is ${input.railBindingStatus}.`,
      suggestedFix: {
        action: 'resolve_rail_binding',
        details: 'Resolve rail binding diagnostics for touched entities.'
      },
      sourceFields: ['railBindingStatus']
    });
  }

  return sortGovernanceErrors(
    errors.map((error) => ({
      ...error,
      sourceFields: sortSourceFields(error.sourceFields)
    }))
  );
}

export function buildGovernanceReport(input: {
  declaredTier: number | null;
  impliedTier: number | null;
  labelTier: number | null;
  missingLabels: string[];
  missingEvidenceFields: string[];
  requiredChecks: string[];
  projectsTouched: string[];
  teamsTouched: string[];
  swarmsDeclared?: string[];
  swarmsTouched: string[];
  swarmOrchestrationStatus?: 'ok' | 'missing_registry' | 'invalid_graph' | 'violations';
  swarmOrchestrationViolations?: string[];
  swarmDependencyEdges?: Array<{ from: string; to: string }>;
  swarmTopologicalOrder?: string[];
  swarmPhaseBySwarm?: Record<string, string>;
  swarmCycleDetected?: string[];
  swarmWarnings?: string[];
  swarmMode?: SwarmMode | null;
  swarmTeamId?: string | null;
  unownedFiles: string[];
  ownershipStatus: OwnershipStatus;
  entitiesTouched?: string[];
  entityOwnershipStatus?: EntityOwnershipStatus;
  unmappedProjects?: string[];
  entityByProject?: Record<string, string | null>;
  entityRailProfileByEntity?: Record<string, RailProfile | null>;
  entitiesMissingRailProfile?: string[];
  railBindingStatus?: RailBindingStatus;
  railViolations?: RailViolation[];
  railProfilesTouched?: string[];
  autonomousContextDetected?: boolean;
  branchNamespaceValid?: boolean;
  structuredPathsTouched?: string[];
  autonomousPathsTouched?: string[];
  isolationStatus?: IsolationStatus;
  isolationViolations?: IsolationViolationCode[];
  nextActions: string[];
  warnings: string[];
  executionModesTouched: ExecutionMode[];
  modeBoundaryStatus: ModeBoundaryStatus;
  conflictingTeams: string[];
  conflictingPaths: string[];
  swarmExecutionModesTouched: ExecutionMode[];
  modeWarnings: string[];
  unownedPaths: string[];
  ambiguousPaths: string[];
  metadataSource?: {
    bodySource: ProvenanceSource | 'ci' | 'cli' | 'template';
    bodyPath: string | null;
    labelSource: ProvenanceSource | 'ci' | 'cli';
    labelsPath: string | null;
    commentSource?: ProvenanceSource;
  };
  commentEvidenceDetected?: boolean;
  commentEvidenceCount?: number;
  sealWarnings?: string[];
  additionalErrors?: GovernanceError[];
  executionContext?: {
    context: 'local' | 'ci';
    executionMode: 'structured' | 'autonomous' | 'unknown';
    retryEnabled: boolean;
  };
  retryTrace?: {
    attempted: boolean;
    retryCount: 0 | 1;
    initialStatus: 'passed' | 'failed';
    finalStatus: 'passed' | 'failed';
    triggerErrorCode: string | null;
    retryable: boolean;
    patchApplied: string | null;
  };
}): GovernanceReport {
  const modePolicy = evaluateModePolicy({
    executionModesTouched: input.executionModesTouched,
    declaredTier: input.declaredTier
  });
  const canonicalErrors = buildCanonicalGovernanceErrors({
    declaredTier: input.declaredTier,
    impliedTier: input.impliedTier,
    missingLabels: input.missingLabels,
    missingEvidenceFields: input.missingEvidenceFields,
    ownershipStatus: input.ownershipStatus,
    swarmOrchestrationStatus: input.swarmOrchestrationStatus ?? 'ok',
    railBindingStatus: input.railBindingStatus ?? 'ok',
    modeEnforcementStatus: modePolicy.status,
    modeViolation: modePolicy.violation,
    unownedPaths: input.unownedPaths
  });

  const additionalErrors = input.additionalErrors ?? [];
  const allErrors = sortGovernanceErrors([
    ...canonicalErrors,
    ...additionalErrors.map((error) => ({
      ...error,
      sourceFields: sortSourceFields(error.sourceFields)
    }))
  ]);

  const resolveLegacySource = (
    source: ProvenanceSource | 'ci' | 'cli' | 'template' | undefined
  ): ProvenanceSource => {
    if (!source) {
      return 'unknown';
    }
    if (source === 'ci') {
      return 'gh';
    }
    if (source === 'cli' || source === 'template') {
      return 'local';
    }
    return source;
  };

  return {
    declaredTier: input.declaredTier,
    impliedTier: input.impliedTier,
    labelTier: input.labelTier,
    missingLabels: sortedUnique(input.missingLabels),
    missingEvidenceFields: sortedUnique(input.missingEvidenceFields),
    requiredChecks: sortedUnique(input.requiredChecks),
    projectsTouched: sortedUnique(input.projectsTouched),
    teamsTouched: sortedUnique(input.teamsTouched),
    swarmsDeclared: sortedUnique(input.swarmsDeclared ?? []),
    swarmsTouched: sortedUnique(input.swarmsTouched),
    swarmOrchestrationStatus: input.swarmOrchestrationStatus ?? 'ok',
    swarmOrchestrationViolations: sortedUnique(input.swarmOrchestrationViolations ?? []),
    swarmDependencyEdges: sortSwarmDependencyEdges(input.swarmDependencyEdges ?? []),
    swarmTopologicalOrder: [...(input.swarmTopologicalOrder ?? [])],
    swarmPhaseBySwarm: sortRecordByKey(input.swarmPhaseBySwarm ?? {}),
    ...(input.swarmCycleDetected && input.swarmCycleDetected.length > 0
      ? { swarmCycleDetected: [...input.swarmCycleDetected] }
      : {}),
    swarmWarnings: sortedUnique(input.swarmWarnings ?? []),
    swarmMode: input.swarmMode ?? null,
    swarmTeamId: input.swarmTeamId ?? null,
    unownedFiles: sortedUnique(input.unownedFiles),
    ownershipStatus: input.ownershipStatus,
    entitiesTouched: sortedUnique(input.entitiesTouched ?? []),
    entityOwnershipStatus: input.entityOwnershipStatus ?? 'ok',
    unmappedProjects: sortedUnique(input.unmappedProjects ?? []),
    entityByProject: sortRecordByKey(input.entityByProject ?? {}),
    entityRailProfileByEntity: sortRecordByKey(input.entityRailProfileByEntity ?? {}),
    entitiesMissingRailProfile: sortedUnique(input.entitiesMissingRailProfile ?? []),
    railBindingStatus: input.railBindingStatus ?? 'ok',
    railViolations: sortRailViolations(input.railViolations ?? []),
    autonomousContextDetected: input.autonomousContextDetected ?? false,
    branchNamespaceValid: input.branchNamespaceValid ?? true,
    structuredPathsTouched: sortedUnique(input.structuredPathsTouched ?? []),
    autonomousPathsTouched: sortedUnique(input.autonomousPathsTouched ?? []),
    isolationStatus: input.isolationStatus ?? 'ok',
    isolationViolations: sortedUnique(input.isolationViolations ?? []),
    nextActions: sortedUnique(input.nextActions),
    warnings: sortedUnique(input.warnings),
    executionModesTouched: sortedUnique(input.executionModesTouched),
    modeBoundaryStatus: input.modeBoundaryStatus,
    conflictingTeams: sortedUnique(input.conflictingTeams),
    conflictingPaths: sortedUnique(input.conflictingPaths),
    swarmExecutionModesTouched: sortedUnique(input.swarmExecutionModesTouched),
    modeWarnings: sortedUnique(input.modeWarnings),
    unownedPaths: sortedUnique(input.unownedPaths),
    ambiguousPaths: sortedUnique(input.ambiguousPaths),
    modeEnforcementStatus: modePolicy.status,
    modeViolation: modePolicy.violation,
    requiredMinimumTier: modePolicy.requiredMinimumTier,
    errors: allErrors,
    metadataSource: {
      bodySource: resolveLegacySource(input.metadataSource?.bodySource ?? 'stub'),
      bodyPath: input.metadataSource?.bodyPath ?? null,
      labelSource: resolveLegacySource(input.metadataSource?.labelSource ?? 'stub'),
      labelsPath: input.metadataSource?.labelsPath ?? null,
      commentSource: resolveLegacySource(input.metadataSource?.commentSource ?? 'none')
    },
    commentEvidenceDetected: input.commentEvidenceDetected ?? false,
    commentEvidenceCount: input.commentEvidenceCount ?? 0,
    sealWarnings: sortedUnique(input.sealWarnings ?? []),
    executionContext: input.executionContext ?? {
      context: 'local',
      executionMode: 'unknown',
      retryEnabled: false
    },
    retryTrace: input.retryTrace ?? {
      attempted: false,
      retryCount: 0,
      initialStatus: 'passed',
      finalStatus: 'passed',
      triggerErrorCode: null,
      retryable: false,
      patchApplied: null
    },
    ...(input.railProfilesTouched && input.railProfilesTouched.length > 0
      ? { railProfilesTouched: sortedUnique(input.railProfilesTouched) }
      : {})
  };
}

export function stringifyGovernanceReport(report: GovernanceReport): string {
  return JSON.stringify(report);
}

export function resolveDeclaredTier(options: { tierBody?: Tier; tierBodyLabel?: Tier }): Tier | null {
  return options.tierBody ?? options.tierBodyLabel ?? null;
}

export function getMissingTierLabels(labelTier: Tier | null): string[] {
  if (labelTier === null) {
    return [...TIER_LABELS];
  }
  return [];
}

export function shouldWarnStalePayload(errors: string[]): boolean {
  const patterns = [
    'Missing unfenced PR body tier declaration',
    'Evidence block',
    'Risk tier mismatch',
    'tier-3-approved',
    'Missing risk tier label'
  ];

  return errors.some((error) => patterns.some((pattern) => error.includes(pattern)));
}

export function selectPrimaryAction(actions: string[]): string | null {
  if (actions.length === 0) {
    return null;
  }

  const priorities = [
    'Add exactly one label:',
    'Add label:',
    'Update PR body evidence Risk Tier',
    'Update unfenced PR body declaration',
    'Update PR body to include required evidence block',
    'Run: npm run bootstrap:labels',
    'Run: git commit --allow-empty'
  ];

  for (const prefix of priorities) {
    const match = actions.find((action) => action.startsWith(prefix));
    if (match) {
      return match;
    }
  }

  return actions[0];
}

export function buildStalePayloadActions(): string[] {
  return ['Run: git commit --allow-empty -m "chore: refresh governance"', 'Run: git push'];
}

export function buildBootstrapActions(repo?: string): string[] {
  const repoArg = repo ? ` -- --repo ${repo} --yes` : ' -- --repo owner/name --yes';
  return [
    `Run: npm run bootstrap:labels${repoArg}`,
    'Run: npm run bootstrap:labels -- --repo owner/name --dry-run'
  ];
}

export function buildEvidenceBlockAction(): string {
  return 'Update PR body to include required evidence block fields.';
}
