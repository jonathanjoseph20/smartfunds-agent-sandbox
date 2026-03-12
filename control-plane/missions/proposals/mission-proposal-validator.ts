import { getMissionTemplate, listMissionTemplates } from '../templates/mission-template-registry.ts';
import { validateMissionTemplateParameters } from '../templates/mission-template-validator.ts';
import { loadMissionDefinitions } from '../mission-registry.ts';
import type { DeliverableDescriptor, SourceReference } from '../mission-types.ts';

import type { MissionProposalDefinition } from './mission-proposal-definition-types.ts';
import {
  MISSION_PROPOSAL_APPROVAL_STATES,
  MISSION_PROPOSAL_CREATED_BY_KINDS,
  MISSION_PROPOSAL_CREATED_FROM_KINDS,
  MISSION_PROPOSAL_PRIORITIES,
  MISSION_PROPOSAL_STATES,
  type MissionProposalInstance,
} from './mission-proposal-types.ts';
import {
  deriveMissionProposalIdFromPayload,
  type MissionProposalIdentityPayload,
} from './mission-proposal-identity.ts';

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

function asCanonicalObject(value: unknown, fieldName: string, sourceLabel: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an object.`);
  }
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function asUniqueStringArray(value: unknown, sourceLabel: string, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an array of non-empty strings.`);
  }

  const normalized = value.map((entry) => asTrimmedString(entry));
  if (normalized.some((entry) => !entry)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an array of non-empty strings.`);
  }

  return uniqueSorted(normalized as string[]);
}

function normalizeDeliverable(entry: DeliverableDescriptor | string, sourceLabel: string, fieldName: string): DeliverableDescriptor {
  if (typeof entry === 'string') {
    const deliverableId = asTrimmedString(entry);
    if (!deliverableId) {
      throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} contains an invalid deliverable string.`);
    }
    return { deliverableId };
  }

  if (!isRecord(entry)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} contains an invalid deliverable object.`);
  }

  const deliverableId = asTrimmedString(entry.deliverableId);
  if (!deliverableId) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} deliverableId must be a non-empty string.`);
  }

  const description = asTrimmedString(entry.description);
  const satisfied = entry.satisfied;

  if (satisfied !== undefined && typeof satisfied !== 'boolean') {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} satisfied must be a boolean when provided.`);
  }

  return {
    deliverableId,
    ...(description ? { description } : {}),
    ...(satisfied === undefined ? {} : { satisfied }),
  };
}

function asDeliverableArray(value: unknown, sourceLabel: string, fieldName: string): DeliverableDescriptor[] {
  if (!Array.isArray(value)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an array.`);
  }

  return value
    .map((entry) => normalizeDeliverable(entry as DeliverableDescriptor | string, sourceLabel, fieldName))
    .sort((left, right) => left.deliverableId.localeCompare(right.deliverableId));
}

function asSourceReference(entry: unknown, sourceLabel: string, fieldName: string): SourceReference {
  if (!isRecord(entry)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must contain objects.`);
  }

  const sourceKind = asTrimmedString(entry.sourceKind);
  const sourceId = asTrimmedString(entry.sourceId);
  const reference = asTrimmedString(entry.reference);
  const title = asTrimmedString(entry.title);

  if (!sourceKind || !sourceId || !reference) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} entries require sourceKind, sourceId, and reference.`);
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
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} ${fieldName} must be an array.`);
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

function asCreatedBy(value: unknown, sourceLabel: string): MissionProposalInstance['createdBy'] {
  if (!isRecord(value)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} createdBy must be an object.`);
  }

  const kind = asTrimmedString(value.kind);
  const id = asTrimmedString(value.id);
  const displayName = asTrimmedString(value.displayName);

  if (!kind || !MISSION_PROPOSAL_CREATED_BY_KINDS.includes(kind)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} createdBy.kind must be one of ${MISSION_PROPOSAL_CREATED_BY_KINDS.join(', ')}.`);
  }
  if (!id) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} createdBy.id must be a non-empty string.`);
  }
  if (!displayName) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} createdBy.displayName must be a non-empty string.`);
  }

  return {
    kind,
    id,
    displayName,
  };
}

function asCreatedFrom(value: unknown, sourceLabel: string): MissionProposalInstance['createdFrom'] {
  if (!isRecord(value)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} createdFrom must be an object.`);
  }

  const kind = asTrimmedString(value.kind);
  const id = asTrimmedString(value.id);
  const reason = asTrimmedString(value.reason);

  if (!kind || !MISSION_PROPOSAL_CREATED_FROM_KINDS.includes(kind)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} createdFrom.kind must be one of ${MISSION_PROPOSAL_CREATED_FROM_KINDS.join(', ')}.`);
  }
  if (!id) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} createdFrom.id must be a non-empty string.`);
  }

  return {
    kind,
    id,
    ...(reason ? { reason } : {}),
  };
}

function assertTemplateAndMissionLinkage(input: {
  sourceLabel: string;
  proposedTemplateId: string;
  proposedMissionType: string;
  proposedParameters: Record<string, unknown>;
  missionTemplateDefinitionsDir?: string;
  missionDefinitionsDir?: string;
}): void {
  const missionTypes = new Set(loadMissionDefinitions({ definitionsDir: input.missionDefinitionsDir })
    .map((entry) => entry.missionType));

  if (input.proposedMissionType.length > 0 && !missionTypes.has(input.proposedMissionType)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_MISSION_TYPE: ${input.proposedMissionType}`);
  }

  if (input.proposedTemplateId.length > 0) {
    let template;
    try {
      template = getMissionTemplate(input.proposedTemplateId, { definitionsDir: input.missionTemplateDefinitionsDir });
    } catch {
      throw new Error(`MISSION_PROPOSAL_TEMPLATE_NOT_FOUND: ${input.proposedTemplateId}`);
    }

    validateMissionTemplateParameters(template, input.proposedParameters);

    if (input.proposedMissionType.length > 0 && template.missionType !== input.proposedMissionType) {
      throw new Error(`MISSION_PROPOSAL_TEMPLATE_MISSION_MISMATCH: ${input.proposedTemplateId}`);
    }
  }
}

export function validateMissionProposalDefinition(value: unknown, sourceLabel = '<inline>'): MissionProposalDefinition {
  if (!isRecord(value)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} definition must be an object.`);
  }

  const proposalType = asTrimmedString(value.proposalType);
  const displayName = asTrimmedString(value.displayName);
  const description = asTrimmedString(value.description);
  const summary = asTrimmedString(value.summary);
  const enabled = asBoolean(value.enabled);
  const recommendedPriority = asTrimmedString(value.recommendedPriority);
  const defaultProposedMissionType = asTrimmedString(value.defaultProposedMissionType);
  const defaultProposedTemplateId = asTrimmedString(value.defaultProposedTemplateId) ?? undefined;

  if (!proposalType) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} proposalType must be a non-empty string.`);
  }
  if (!displayName) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} displayName must be a non-empty string.`);
  }
  if (!description) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} description must be a non-empty string.`);
  }
  if (!summary) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} summary must be a non-empty string.`);
  }
  if (enabled === null) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} enabled must be a boolean.`);
  }
  if (!recommendedPriority || !MISSION_PROPOSAL_PRIORITIES.includes(recommendedPriority)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} recommendedPriority must be one of ${MISSION_PROPOSAL_PRIORITIES.join(', ')}.`);
  }
  if (!defaultProposedMissionType) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} defaultProposedMissionType must be a non-empty string.`);
  }

  return {
    proposalType,
    displayName,
    description,
    summary,
    enabled,
    recommendedPriority,
    defaultProposedMissionType,
    ...(defaultProposedTemplateId ? { defaultProposedTemplateId } : {}),
    supportedMissionTypes: asUniqueStringArray(value.supportedMissionTypes, sourceLabel, 'supportedMissionTypes'),
    supportedTemplateIds: asUniqueStringArray(value.supportedTemplateIds, sourceLabel, 'supportedTemplateIds'),
    allowedCreatedByKinds: asUniqueStringArray(value.allowedCreatedByKinds, sourceLabel, 'allowedCreatedByKinds')
      .map((entry) => {
        if (!MISSION_PROPOSAL_CREATED_BY_KINDS.includes(entry)) {
          throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} allowedCreatedByKinds contains unsupported kind ${entry}.`);
        }
        return entry;
      }),
    allowedCreatedFromKinds: asUniqueStringArray(value.allowedCreatedFromKinds, sourceLabel, 'allowedCreatedFromKinds')
      .map((entry) => {
        if (!MISSION_PROPOSAL_CREATED_FROM_KINDS.includes(entry)) {
          throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} allowedCreatedFromKinds contains unsupported kind ${entry}.`);
        }
        return entry;
      }),
  };
}

export function validateMissionProposalInstance(
  value: unknown,
  sourceLabel = '<inline>',
  options: {
    missionTemplateDefinitionsDir?: string;
    missionDefinitionsDir?: string;
  } = {},
): MissionProposalInstance {
  if (!isRecord(value)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} instance must be an object.`);
  }

  const proposalType = asTrimmedString(value.proposalType);
  const displayName = asTrimmedString(value.displayName);
  const summary = asTrimmedString(value.summary);
  const objective = asTrimmedString(value.objective);
  const rationale = asTrimmedString(value.rationale);
  const proposedMissionType = asTrimmedString(value.proposedMissionType) ?? '';
  const proposedTemplateId = asTrimmedString(value.proposedTemplateId) ?? '';
  const proposedFounderInstructions = asTrimmedString(value.proposedFounderInstructions) ?? '';
  const approvalState = asTrimmedString(value.approvalState);
  const proposalState = asTrimmedString(value.proposalState);
  const recommendedPriority = asTrimmedString(value.recommendedPriority);
  const historyDigest = asTrimmedString(value.historyDigest) ?? '';

  if (!proposalType) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} proposalType must be a non-empty string.`);
  }
  if (!displayName) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} displayName must be a non-empty string.`);
  }
  if (!summary) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} summary must be a non-empty string.`);
  }
  if (!objective) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} objective must be a non-empty string.`);
  }
  if (!rationale) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} rationale must be a non-empty string.`);
  }
  if (!approvalState || !MISSION_PROPOSAL_APPROVAL_STATES.includes(approvalState)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} approvalState must be one of ${MISSION_PROPOSAL_APPROVAL_STATES.join(', ')}.`);
  }
  if (!proposalState || !MISSION_PROPOSAL_STATES.includes(proposalState)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} proposalState must be one of ${MISSION_PROPOSAL_STATES.join(', ')}.`);
  }
  if (!recommendedPriority || !MISSION_PROPOSAL_PRIORITIES.includes(recommendedPriority)) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} recommendedPriority must be one of ${MISSION_PROPOSAL_PRIORITIES.join(', ')}.`);
  }

  const requestedDeliverables = asDeliverableArray(value.requestedDeliverables, sourceLabel, 'requestedDeliverables');
  const sourceReferences = asSourceReferenceArray(value.sourceReferences, sourceLabel, 'sourceReferences');
  const linkedMissionIds = asUniqueStringArray(value.linkedMissionIds, sourceLabel, 'linkedMissionIds');
  const linkedDagIds = asUniqueStringArray(value.linkedDagIds, sourceLabel, 'linkedDagIds');
  const linkedActionPlanIds = asUniqueStringArray(value.linkedActionPlanIds, sourceLabel, 'linkedActionPlanIds');
  const linkedPortfolioIds = asUniqueStringArray(value.linkedPortfolioIds, sourceLabel, 'linkedPortfolioIds');
  const blockingReasons = asUniqueStringArray(value.blockingReasons, sourceLabel, 'blockingReasons');
  const limitations = asUniqueStringArray(value.limitations, sourceLabel, 'limitations');
  const proposedParameters = asCanonicalObject(value.proposedParameters, 'proposedParameters', sourceLabel);
  const createdBy = asCreatedBy(value.createdBy, sourceLabel);
  const createdFrom = asCreatedFrom(value.createdFrom, sourceLabel);

  assertTemplateAndMissionLinkage({
    sourceLabel,
    proposedTemplateId,
    proposedMissionType,
    proposedParameters,
    missionTemplateDefinitionsDir: options.missionTemplateDefinitionsDir,
    missionDefinitionsDir: options.missionDefinitionsDir,
  });

  const expectedProposalId = deriveMissionProposalIdFromPayload({
    proposalType,
    objective,
    summary,
    rationale,
    proposedMissionType,
    proposedTemplateId,
    proposedParameters,
    requestedDeliverables,
    sourceReferences,
    linkedMissionIds,
    linkedDagIds,
    linkedActionPlanIds,
    createdBy: { kind: createdBy.kind },
    createdFrom: { kind: createdFrom.kind },
  } satisfies MissionProposalIdentityPayload);

  const proposalId = asTrimmedString(value.proposalId) ?? expectedProposalId;
  if (proposalId !== expectedProposalId) {
    throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${sourceLabel} proposalId does not match deterministic identity.`);
  }

  return {
    proposalId,
    proposalType,
    displayName,
    summary,
    objective,
    rationale,
    proposedMissionType,
    proposedTemplateId,
    proposedParameters,
    proposedFounderInstructions,
    requestedDeliverables,
    sourceReferences,
    linkedMissionIds,
    linkedDagIds,
    linkedActionPlanIds,
    linkedPortfolioIds,
    createdBy,
    createdFrom,
    approvalState,
    proposalState,
    blockingReasons,
    limitations,
    recommendedPriority,
    historyDigest,
  };
}

export function validateMissionProposalDefinitionLinkage(input: {
  definition: MissionProposalDefinition;
  missionTemplateDefinitionsDir?: string;
  missionDefinitionsDir?: string;
}): void {
  const missionTypes = new Set(loadMissionDefinitions({ definitionsDir: input.missionDefinitionsDir })
    .map((entry) => entry.missionType));

  for (const missionType of input.definition.supportedMissionTypes) {
    if (!missionTypes.has(missionType)) {
      throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${input.definition.proposalType} supportedMissionTypes contains unknown missionType ${missionType}.`);
    }
  }

  const templateIds = new Set(listMissionTemplates({ definitionsDir: input.missionTemplateDefinitionsDir })
    .map((entry) => entry.templateId));

  for (const templateId of input.definition.supportedTemplateIds) {
    if (!templateIds.has(templateId)) {
      throw new Error(`MISSION_PROPOSAL_INVALID_SCHEMA: ${input.definition.proposalType} supportedTemplateIds contains unknown templateId ${templateId}.`);
    }
  }
}
