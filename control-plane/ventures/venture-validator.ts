import fs from 'node:fs';
import path from 'node:path';

import {
  normalizeSemanticStringArray,
  normalizeVentureSlug,
} from './venture-identity.ts';
import {
  VENTURE_CLASSES,
  VENTURE_LIFECYCLE_STATES,
  VENTURE_OPERATING_MODES,
  VENTURE_OWNERSHIP_MODELS,
  VENTURE_STATUSES,
  type VentureDefinition,
  type VentureValidationFinding,
  type VentureValidationOutcome,
  type VentureValidationResult,
} from './venture-types.ts';

export interface VentureValidatorReferenceContext {
  knownMissionIds: Set<string>;
  knownTeamIds: Set<string>;
  knownEntityIds: Set<string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => asString(entry))
    .filter((entry) => entry.length > 0);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function pushFinding(findings: VentureValidationFinding[], ventureId: string, field: string, code: string, message: string): void {
  findings.push({ ventureId, field, code, message });
}

function normalizeDefinition(value: unknown): VentureDefinition {
  const record = isRecord(value) ? value : {};
  const provenanceInputs = isRecord(record.provenanceInputs) ? record.provenanceInputs : {};

  return {
    ...(asString(record.ventureId) ? { ventureId: asString(record.ventureId) } : {}),
    ventureName: asString(record.ventureName),
    ventureSlug: normalizeVentureSlug(asString(record.ventureSlug)),
    ventureClass: asString(record.ventureClass) as VentureDefinition['ventureClass'],
    ...(asString(record.ventureStatus) ? { ventureStatus: asString(record.ventureStatus) as VentureDefinition['ventureStatus'] } : {}),
    ventureLifecycleState: asString(record.ventureLifecycleState) as VentureDefinition['ventureLifecycleState'],
    ownershipModel: asString(record.ownershipModel) as VentureDefinition['ownershipModel'],
    operatingMode: asString(record.operatingMode) as VentureDefinition['operatingMode'],
    originMissionIds: uniqueSorted(asStringArray(record.originMissionIds)),
    linkedMissionPortfolioIds: uniqueSorted(asStringArray(record.linkedMissionPortfolioIds)),
    linkedTeamIds: uniqueSorted(asStringArray(record.linkedTeamIds)),
    linkedEntityIds: uniqueSorted(asStringArray(record.linkedEntityIds)),
    summary: asString(record.summary),
    domainTags: normalizeSemanticStringArray(asStringArray(record.domainTags)),
    productTypeTags: normalizeSemanticStringArray(asStringArray(record.productTypeTags)),
    jurisdictionTags: normalizeSemanticStringArray(asStringArray(record.jurisdictionTags)),
    limitations: uniqueSorted(asStringArray(record.limitations)),
    blockingReasons: uniqueSorted(asStringArray(record.blockingReasons)),
    provenanceInputs: {
      source: asString(provenanceInputs.source),
      referenceIds: uniqueSorted(asStringArray(provenanceInputs.referenceIds)),
      ...(asString(provenanceInputs.notes) ? { notes: asString(provenanceInputs.notes) } : {}),
    },
  };
}

function deriveOutcome(findings: VentureValidationFinding[]): VentureValidationOutcome {
  const codes = new Set(findings.map((finding) => finding.code));

  const blockedCodes = [
    'required',
    'invalid_enum',
    'invalid_slug',
    'invalid_operating_mode_for_class',
    'ownership_contradiction',
    'provenance_missing_source',
    'provenance_missing_reference_ids',
    'invalid_venture_name',
  ];

  const inconclusiveCodes = [
    'classification_inconclusive',
  ];

  const incompleteCodes = [
    'missing_origin_missions',
    'missing_domain_tags',
    'missing_product_type_tags',
    'invalid_mission_reference',
    'invalid_team_reference',
    'invalid_entity_reference',
  ];

  if (blockedCodes.some((code) => codes.has(code))) {
    return 'blocked';
  }
  if (inconclusiveCodes.some((code) => codes.has(code))) {
    return 'inconclusive';
  }
  if (incompleteCodes.some((code) => codes.has(code))) {
    return 'incomplete';
  }
  return 'satisfied';
}

function validateEnums(normalized: VentureDefinition, findings: VentureValidationFinding[], ventureId: string): void {
  if (!VENTURE_CLASSES.includes(normalized.ventureClass)) {
    pushFinding(findings, ventureId, 'ventureClass', 'invalid_enum', 'ventureClass must be a supported enum value.');
  }
  if (!VENTURE_LIFECYCLE_STATES.includes(normalized.ventureLifecycleState)) {
    pushFinding(findings, ventureId, 'ventureLifecycleState', 'invalid_enum', 'ventureLifecycleState must be a supported enum value.');
  }
  if (!VENTURE_OWNERSHIP_MODELS.includes(normalized.ownershipModel)) {
    pushFinding(findings, ventureId, 'ownershipModel', 'invalid_enum', 'ownershipModel must be a supported enum value.');
  }
  if (!VENTURE_OPERATING_MODES.includes(normalized.operatingMode)) {
    pushFinding(findings, ventureId, 'operatingMode', 'invalid_enum', 'operatingMode must be a supported enum value.');
  }
  if (normalized.ventureStatus !== undefined && !VENTURE_STATUSES.includes(normalized.ventureStatus)) {
    pushFinding(findings, ventureId, 'ventureStatus', 'invalid_enum', 'ventureStatus must be a supported enum value.');
  }
}

function validateRequiredFields(normalized: VentureDefinition, findings: VentureValidationFinding[], ventureId: string): void {
  const requiredFields: Array<keyof VentureDefinition> = [
    'ventureName',
    'ventureSlug',
    'ventureClass',
    'ventureLifecycleState',
    'ownershipModel',
    'operatingMode',
    'summary',
  ];

  for (const field of requiredFields) {
    const value = normalized[field];
    if (typeof value !== 'string' || value.length === 0) {
      pushFinding(findings, ventureId, String(field), 'required', `${String(field)} is required.`);
    }
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalized.ventureSlug)) {
    pushFinding(findings, ventureId, 'ventureSlug', 'invalid_slug', 'ventureSlug must be lowercase kebab-case.');
  }

  if (normalized.ventureName.length < 3) {
    pushFinding(findings, ventureId, 'ventureName', 'invalid_venture_name', 'ventureName must have at least 3 characters.');
  }
}

function validateCrossFieldRules(normalized: VentureDefinition, findings: VentureValidationFinding[], ventureId: string): void {
  if (normalized.ownershipModel === 'joint_venture' && normalized.ventureClass !== 'joint_venture_candidate') {
    pushFinding(
      findings,
      ventureId,
      'ownershipModel',
      'ownership_contradiction',
      'joint_venture ownershipModel requires joint_venture_candidate class.',
    );
  }

  if (normalized.ownershipModel === 'spinout_planned' && normalized.ventureClass !== 'spinout_candidate') {
    pushFinding(
      findings,
      ventureId,
      'ownershipModel',
      'ownership_contradiction',
      'spinout_planned ownershipModel requires spinout_candidate class.',
    );
  }

  if (
    normalized.ventureClass === 'internal_tooling_venture'
    && (normalized.ownershipModel === 'joint_venture' || normalized.ownershipModel === 'external_partnership')
  ) {
    pushFinding(
      findings,
      ventureId,
      'ownershipModel',
      'ownership_contradiction',
      'internal_tooling_venture cannot use external ownership models.',
    );
  }

  if (normalized.ventureClass === 'internal_tooling_venture' && normalized.operatingMode === 'autonomous') {
    pushFinding(
      findings,
      ventureId,
      'operatingMode',
      'invalid_operating_mode_for_class',
      'internal_tooling_venture cannot be autonomous in this sprint.',
    );
  }

  if (normalized.ventureClass === 'inconclusive_classification' && normalized.operatingMode !== 'manual') {
    pushFinding(
      findings,
      ventureId,
      'operatingMode',
      'classification_inconclusive',
      'inconclusive_classification should remain manual until resolved.',
    );
  }
}

function validateReferences(
  normalized: VentureDefinition,
  findings: VentureValidationFinding[],
  ventureId: string,
  context: VentureValidatorReferenceContext,
): void {
  for (const missionId of normalized.originMissionIds) {
    if (!context.knownMissionIds.has(missionId)) {
      pushFinding(findings, ventureId, 'originMissionIds', 'invalid_mission_reference', `Unknown mission reference: ${missionId}.`);
    }
  }

  for (const teamId of normalized.linkedTeamIds) {
    if (!context.knownTeamIds.has(teamId)) {
      pushFinding(findings, ventureId, 'linkedTeamIds', 'invalid_team_reference', `Unknown team reference: ${teamId}.`);
    }
  }

  for (const entityId of normalized.linkedEntityIds) {
    if (!context.knownEntityIds.has(entityId)) {
      pushFinding(findings, ventureId, 'linkedEntityIds', 'invalid_entity_reference', `Unknown entity reference: ${entityId}.`);
    }
  }
}

function validateCompleteness(normalized: VentureDefinition, findings: VentureValidationFinding[], ventureId: string): void {
  if (normalized.originMissionIds.length === 0) {
    pushFinding(findings, ventureId, 'originMissionIds', 'missing_origin_missions', 'originMissionIds should not be empty.');
  }

  if (normalized.domainTags.length === 0) {
    pushFinding(findings, ventureId, 'domainTags', 'missing_domain_tags', 'domainTags should not be empty.');
  }

  if (normalized.productTypeTags.length === 0) {
    pushFinding(findings, ventureId, 'productTypeTags', 'missing_product_type_tags', 'productTypeTags should not be empty.');
  }

  if (normalized.provenanceInputs.source.length === 0) {
    pushFinding(findings, ventureId, 'provenanceInputs.source', 'provenance_missing_source', 'provenanceInputs.source is required.');
  }

  if (normalized.provenanceInputs.referenceIds.length === 0) {
    pushFinding(
      findings,
      ventureId,
      'provenanceInputs.referenceIds',
      'provenance_missing_reference_ids',
      'provenanceInputs.referenceIds should contain at least one reference.',
    );
  }
}

function defaultReferenceContext(): VentureValidatorReferenceContext {
  return {
    knownMissionIds: new Set<string>(),
    knownTeamIds: new Set<string>(),
    knownEntityIds: new Set<string>(),
  };
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function loadMissionIds(): Set<string> {
  const missionIds = new Set<string>();

  const instancesDir = path.resolve('control-plane/missions/instances');
  if (fs.existsSync(instancesDir)) {
    for (const fileName of fs.readdirSync(instancesDir).filter((entry) => entry.endsWith('.json')).sort()) {
      const parsed = readJson(path.join(instancesDir, fileName));
      if (isRecord(parsed)) {
        const missionId = asString(parsed.missionId);
        if (missionId) {
          missionIds.add(missionId);
        }
      }
    }
  }

  return missionIds;
}

function loadTeamIds(): Set<string> {
  const teamIds = new Set<string>();
  const definitionsDir = path.resolve('control-plane/teams/definitions');

  if (!fs.existsSync(definitionsDir)) {
    return teamIds;
  }

  for (const fileName of fs.readdirSync(definitionsDir).filter((entry) => entry.endsWith('.json')).sort()) {
    const parsed = readJson(path.join(definitionsDir, fileName));
    if (isRecord(parsed)) {
      const teamId = asString(parsed.teamId);
      if (teamId) {
        teamIds.add(teamId);
      }
    }
  }

  return teamIds;
}

function loadEntityIds(): Set<string> {
  const entityIds = new Set<string>();
  const registryPath = path.resolve('control-plane/entities/registry.json');

  if (!fs.existsSync(registryPath)) {
    return entityIds;
  }

  const parsed = readJson(registryPath);
  if (!Array.isArray(parsed)) {
    return entityIds;
  }

  for (const entry of parsed) {
    if (isRecord(entry)) {
      const entityId = asString(entry.entityId);
      if (entityId) {
        entityIds.add(entityId);
      }
    }
  }

  return entityIds;
}

export function buildVentureValidatorReferenceContext(): VentureValidatorReferenceContext {
  return {
    knownMissionIds: loadMissionIds(),
    knownTeamIds: loadTeamIds(),
    knownEntityIds: loadEntityIds(),
  };
}

export function validateVentureDefinition(
  value: unknown,
  context: VentureValidatorReferenceContext = defaultReferenceContext(),
): VentureValidationResult {
  const normalized = normalizeDefinition(value);
  const ventureId = normalized.ventureId ?? normalized.ventureSlug ?? '<unknown-venture>';
  const findings: VentureValidationFinding[] = [];

  validateRequiredFields(normalized, findings, ventureId);
  validateEnums(normalized, findings, ventureId);
  validateCrossFieldRules(normalized, findings, ventureId);
  validateReferences(normalized, findings, ventureId, context);
  validateCompleteness(normalized, findings, ventureId);

  const outcome = deriveOutcome(findings);

  return {
    ventureId,
    valid: findings.length === 0,
    outcome,
    findings: findings.sort((left, right) => {
      const fieldCmp = left.field.localeCompare(right.field);
      if (fieldCmp !== 0) {
        return fieldCmp;
      }
      return left.code.localeCompare(right.code);
    }),
    normalized,
  };
}

export function isSchemaLevelFinding(code: string): boolean {
  return [
    'required',
    'invalid_enum',
    'invalid_slug',
    'invalid_venture_name',
    'provenance_missing_source',
    'provenance_missing_reference_ids',
  ].includes(code);
}
