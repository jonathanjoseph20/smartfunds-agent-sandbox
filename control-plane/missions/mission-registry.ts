import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import type { MissionDefinition, MissionDefinitionLike } from './mission-definition-types.ts';
import type { MissionInstance } from './mission-instance-types.ts';
import { deriveMissionIdFromPayload } from './mission-identity.ts';
import {
  MISSION_APPROVAL_STATES,
  MISSION_COMPLETION_STATES,
  MISSION_LIFECYCLE_STATES,
  MISSION_READINESS_STATES,
  type DeliverableDescriptor,
  type SourceReference,
} from './mission-types.ts';

export const DEFAULT_MISSION_DEFINITIONS_DIR = 'control-plane/missions/definitions';
export const DEFAULT_MISSION_INSTANCES_DIR = 'control-plane/missions/instances';

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

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function asUniqueStringArray(value: unknown, sourceLabel: string, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an array of non-empty strings.`);
  }

  const normalized = value.map((entry) => asTrimmedString(entry));
  if (normalized.some((entry) => !entry)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an array of non-empty strings.`);
  }

  return uniqueSorted(normalized as string[]);
}

function normalizeDeliverable(entry: DeliverableDescriptor | string, sourceLabel: string, fieldName: string): DeliverableDescriptor {
  if (typeof entry === 'string') {
    const deliverableId = asTrimmedString(entry);
    if (!deliverableId) {
      throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} ${fieldName} contains an invalid deliverable string.`);
    }
    return { deliverableId };
  }

  if (!isRecord(entry)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} ${fieldName} contains an invalid deliverable object.`);
  }

  const deliverableId = asTrimmedString(entry.deliverableId);
  if (!deliverableId) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} ${fieldName} deliverableId must be a non-empty string.`);
  }

  const description = asTrimmedString(entry.description);
  const satisfied = entry.satisfied;

  if (satisfied !== undefined && typeof satisfied !== 'boolean') {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} ${fieldName} satisfied must be a boolean when provided.`);
  }

  return {
    deliverableId,
    ...(description ? { description } : {}),
    ...(satisfied === undefined ? {} : { satisfied }),
  };
}

function asDeliverableArray(value: unknown, sourceLabel: string, fieldName: string): DeliverableDescriptor[] {
  if (!Array.isArray(value)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an array.`);
  }

  return value
    .map((entry) => normalizeDeliverable(entry as DeliverableDescriptor | string, sourceLabel, fieldName))
    .sort((left, right) => left.deliverableId.localeCompare(right.deliverableId));
}

function asSourceReference(entry: unknown, sourceLabel: string, fieldName: string): SourceReference {
  if (!isRecord(entry)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must contain objects.`);
  }

  const sourceKind = asTrimmedString(entry.sourceKind);
  const sourceId = asTrimmedString(entry.sourceId);
  const reference = asTrimmedString(entry.reference);
  const title = asTrimmedString(entry.title);

  if (!sourceKind || !sourceId || !reference) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} ${fieldName} entries require sourceKind, sourceId, and reference.`);
  }

  return {
    sourceKind,
    sourceId,
    reference,
    ...(title ? { title } : {}),
  };
}

function asSourceReferenceArray(value: unknown, sourceLabel: string, fieldName: string): SourceReference[] {
  if (!Array.isArray(value)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an array.`);
  }

  return value
    .map((entry) => asSourceReference(entry, sourceLabel, fieldName))
    .sort((left, right) => {
      const sourceKindCmp = left.sourceKind.localeCompare(right.sourceKind);
      if (sourceKindCmp !== 0) {
        return sourceKindCmp;
      }
      const sourceIdCmp = left.sourceId.localeCompare(right.sourceId);
      if (sourceIdCmp !== 0) {
        return sourceIdCmp;
      }
      return left.reference.localeCompare(right.reference);
    });
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

export function validateMissionDefinition(value: unknown, sourceLabel = '<inline>'): MissionDefinition {
  if (!isRecord(value)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} definition must be an object.`);
  }

  const raw = value as unknown as MissionDefinitionLike;
  const missionType = asTrimmedString(raw.missionType);
  const displayName = asTrimmedString(raw.displayName);
  const enabled = asBoolean(raw.enabled);
  const description = asTrimmedString(raw.description);
  const defaultObjective = asTrimmedString(raw.defaultObjective);
  const defaultPriority = asTrimmedString(raw.defaultPriority);
  const defaultLifecycleState = asTrimmedString(raw.defaultLifecycleState);

  if (!missionType) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} missionType must be a non-empty string.`);
  }
  if (!displayName) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} displayName must be a non-empty string.`);
  }
  if (enabled === null) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} enabled must be a boolean.`);
  }
  if (!description) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} description must be a non-empty string.`);
  }
  if (!defaultObjective) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} defaultObjective must be a non-empty string.`);
  }
  if (!defaultPriority) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} defaultPriority must be a non-empty string.`);
  }
  if (!defaultLifecycleState || !MISSION_LIFECYCLE_STATES.includes(defaultLifecycleState)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} defaultLifecycleState must be one of ${MISSION_LIFECYCLE_STATES.join(', ')}.`);
  }

  return {
    missionType,
    displayName,
    enabled,
    description,
    defaultObjective,
    defaultDeliverables: asDeliverableArray(raw.defaultDeliverables, sourceLabel, 'defaultDeliverables'),
    allowedSourceKinds: asUniqueStringArray(raw.allowedSourceKinds, sourceLabel, 'allowedSourceKinds'),
    defaultPriority,
    defaultLifecycleState,
    tags: asUniqueStringArray(raw.tags, sourceLabel, 'tags'),
  };
}

export function validateMissionInstance(value: unknown, sourceLabel = '<inline>'): MissionInstance {
  if (!isRecord(value)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} instance must be an object.`);
  }

  const missionType = asTrimmedString(value.missionType);
  const displayName = asTrimmedString(value.displayName);
  const objective = asTrimmedString(value.objective) ?? '';
  const founderInstructions = asTrimmedString(value.founderInstructions) ?? '';
  const createdFrom = isRecord(value.createdFrom) ? value.createdFrom : null;
  const createdFromKind = createdFrom ? asTrimmedString(createdFrom.kind) : null;

  if (!missionType) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} missionType must be a non-empty string.`);
  }
  if (!displayName) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} displayName must be a non-empty string.`);
  }
  if (!createdFromKind) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} createdFrom.kind must be a non-empty string.`);
  }

  const requestedDeliverables = asDeliverableArray(value.requestedDeliverables, sourceLabel, 'requestedDeliverables');
  const sourceReferences = asSourceReferenceArray(value.sourceReferences, sourceLabel, 'sourceReferences');
  const linkedActionPlanIds = asUniqueStringArray(value.linkedActionPlanIds, sourceLabel, 'linkedActionPlanIds');
  const linkedPortfolioIds = asUniqueStringArray(value.linkedPortfolioIds, sourceLabel, 'linkedPortfolioIds');
  const linkedMarketSynthesisIds = asUniqueStringArray(value.linkedMarketSynthesisIds, sourceLabel, 'linkedMarketSynthesisIds');
  const recommendedTeamIds = asUniqueStringArray(value.recommendedTeamIds, sourceLabel, 'recommendedTeamIds');
  const assignedTeamIds = asUniqueStringArray(value.assignedTeamIds, sourceLabel, 'assignedTeamIds');
  const blockingReasons = asUniqueStringArray(value.blockingReasons, sourceLabel, 'blockingReasons');
  const limitations = asUniqueStringArray(value.limitations, sourceLabel, 'limitations');

  const approvalState = asTrimmedString(value.approvalState);
  const lifecycleState = asTrimmedString(value.lifecycleState);
  const readinessState = asTrimmedString(value.readinessState);
  const completionState = asTrimmedString(value.completionState);
  const historyDigest = asTrimmedString(value.historyDigest) ?? '';

  if (!approvalState || !MISSION_APPROVAL_STATES.includes(approvalState)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} approvalState must be one of ${MISSION_APPROVAL_STATES.join(', ')}.`);
  }
  if (!lifecycleState || !MISSION_LIFECYCLE_STATES.includes(lifecycleState)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} lifecycleState must be one of ${MISSION_LIFECYCLE_STATES.join(', ')}.`);
  }
  if (!readinessState || !MISSION_READINESS_STATES.includes(readinessState)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} readinessState must be one of ${MISSION_READINESS_STATES.join(', ')}.`);
  }
  if (!completionState || !MISSION_COMPLETION_STATES.includes(completionState)) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} completionState must be one of ${MISSION_COMPLETION_STATES.join(', ')}.`);
  }

  const expectedMissionId = deriveMissionIdFromPayload({
    missionType,
    objective,
    requestedDeliverables,
    sourceReferences,
    linkedActionPlanIds,
    founderInstructions,
    createdFrom: { kind: createdFromKind },
  });

  const missionId = asTrimmedString(value.missionId) ?? expectedMissionId;
  if (missionId !== expectedMissionId) {
    throw new Error(`MISSION_INVALID_SCHEMA: ${sourceLabel} missionId does not match deterministic identity.`);
  }

  return {
    missionId,
    missionType,
    displayName,
    objective,
    founderInstructions,
    requestedDeliverables,
    sourceReferences,
    linkedActionPlanIds,
    linkedPortfolioIds,
    linkedMarketSynthesisIds,
    recommendedTeamIds,
    assignedTeamIds,
    approvalState,
    lifecycleState,
    readinessState,
    completionState,
    blockingReasons,
    limitations,
    createdFrom: {
      kind: createdFromKind,
      ...(asTrimmedString(createdFrom.referenceId) ? { referenceId: asTrimmedString(createdFrom.referenceId)! } : {}),
    },
    historyDigest,
  };
}

export function loadMissionDefinitions(options: { definitionsDir?: string } = {}): MissionDefinition[] {
  const definitionsDir = path.resolve(options.definitionsDir ?? DEFAULT_MISSION_DEFINITIONS_DIR);
  if (!fs.existsSync(definitionsDir)) {
    throw new Error(`MISSION_DEFINITIONS_NOT_FOUND: ${definitionsDir}`);
  }

  const files = fs.readdirSync(definitionsDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => validateMissionDefinition(readJson(path.join(definitionsDir, entry)), entry))
    .sort((left, right) => left.missionType.localeCompare(right.missionType));
}

export function loadMissionInstances(options: { instancesDir?: string } = {}): MissionInstance[] {
  const instancesDir = path.resolve(options.instancesDir ?? DEFAULT_MISSION_INSTANCES_DIR);
  if (!fs.existsSync(instancesDir)) {
    return [];
  }

  const files = fs.readdirSync(instancesDir)
    .filter((entry) => entry.endsWith('.json'))
    .sort((left, right) => left.localeCompare(right));

  return files
    .map((entry) => validateMissionInstance(readJson(path.join(instancesDir, entry)), entry))
    .sort((left, right) => left.missionId.localeCompare(right.missionId));
}

export function writeMissionInstance(instance: MissionInstance, options: { instancesDir?: string } = {}): string {
  const validated = validateMissionInstance(instance, '<write-mission-instance>');
  const instancesDir = path.resolve(options.instancesDir ?? DEFAULT_MISSION_INSTANCES_DIR);
  fs.mkdirSync(instancesDir, { recursive: true });
  const filePath = path.join(instancesDir, `${validated.missionId}.json`);
  fs.writeFileSync(filePath, `${canonicalStringify(validated)}\n`, 'utf8');
  return filePath;
}

export function createMissionRegistry(options: {
  definitionsDir?: string;
  instancesDir?: string;
} = {}) {
  const definitions = loadMissionDefinitions({ definitionsDir: options.definitionsDir });
  const instances = loadMissionInstances({ instancesDir: options.instancesDir });

  const definitionByType = new Map<string, MissionDefinition>();
  for (const definition of definitions) {
    if (definitionByType.has(definition.missionType)) {
      throw new Error(`MISSION_DUPLICATE_DEFINITION: ${definition.missionType}`);
    }
    definitionByType.set(definition.missionType, definition);
  }

  const instanceById = new Map<string, MissionInstance>();
  for (const instance of instances) {
    if (instanceById.has(instance.missionId)) {
      throw new Error(`MISSION_DUPLICATE_INSTANCE: ${instance.missionId}`);
    }
    instanceById.set(instance.missionId, instance);
  }

  function listMissionDefinitions(): MissionDefinition[] {
    return Array.from(definitionByType.values()).sort((left, right) => left.missionType.localeCompare(right.missionType));
  }

  function listMissionInstances(): MissionInstance[] {
    return Array.from(instanceById.values()).sort((left, right) => left.missionId.localeCompare(right.missionId));
  }

  function getMissionDefinition(missionType: string): MissionDefinition {
    const found = definitionByType.get(missionType);
    if (!found) {
      throw new Error(`MISSION_DEFINITION_NOT_FOUND: ${missionType}`);
    }
    return found;
  }

  function getMissionInstance(missionId: string): MissionInstance {
    const found = instanceById.get(missionId);
    if (!found) {
      throw new Error(`MISSION_NOT_FOUND: ${missionId}`);
    }
    return found;
  }

  return {
    listMissionDefinitions,
    listMissionInstances,
    getMissionDefinition,
    getMissionInstance,
  };
}

export type MissionRegistry = ReturnType<typeof createMissionRegistry>;
