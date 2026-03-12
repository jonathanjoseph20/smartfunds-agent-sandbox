import { canonicalStringify, sha256 } from '../../finance/determinism.ts';

import type { DeliverableDescriptor, SourceReference } from '../mission-types.ts';

export interface MissionProposalIdentityPayload {
  proposalType: string;
  objective: string;
  summary: string;
  rationale: string;
  proposedMissionType: string;
  proposedTemplateId: string;
  proposedParameters: Record<string, unknown>;
  requestedDeliverables: DeliverableDescriptor[];
  sourceReferences: SourceReference[];
  linkedMissionIds: string[];
  linkedDagIds: string[];
  linkedActionPlanIds: string[];
  createdBy: {
    kind: string;
  };
  createdFrom: {
    kind: string;
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function normalizeDeliverables(deliverables: DeliverableDescriptor[]): DeliverableDescriptor[] {
  return deliverables
    .map((entry) => ({
      deliverableId: asString(entry.deliverableId),
      ...(asString(entry.description) ? { description: asString(entry.description) } : {}),
      ...(entry.satisfied === undefined ? {} : { satisfied: Boolean(entry.satisfied) }),
    }))
    .filter((entry) => entry.deliverableId.length > 0)
    .sort((left, right) => left.deliverableId.localeCompare(right.deliverableId));
}

function normalizeSourceReferences(sourceReferences: SourceReference[]): SourceReference[] {
  return sourceReferences
    .map((entry) => ({
      sourceKind: asString(entry.sourceKind),
      sourceId: asString(entry.sourceId),
      reference: asString(entry.reference),
      ...(asString(entry.title) ? { title: asString(entry.title) } : {}),
    }))
    .filter((entry) => entry.sourceKind.length > 0 && entry.sourceId.length > 0 && entry.reference.length > 0)
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

function normalizeParameters(parameters: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(parameters)) as Record<string, unknown>;
}

export function normalizeMissionProposalIdentityPayload(payload: MissionProposalIdentityPayload): MissionProposalIdentityPayload {
  return {
    proposalType: asString(payload.proposalType),
    objective: asString(payload.objective),
    summary: asString(payload.summary),
    rationale: asString(payload.rationale),
    proposedMissionType: asString(payload.proposedMissionType),
    proposedTemplateId: asString(payload.proposedTemplateId),
    proposedParameters: normalizeParameters(payload.proposedParameters),
    requestedDeliverables: normalizeDeliverables(payload.requestedDeliverables),
    sourceReferences: normalizeSourceReferences(payload.sourceReferences),
    linkedMissionIds: uniqueSorted(payload.linkedMissionIds),
    linkedDagIds: uniqueSorted(payload.linkedDagIds),
    linkedActionPlanIds: uniqueSorted(payload.linkedActionPlanIds),
    createdBy: {
      kind: asString(payload.createdBy.kind),
    },
    createdFrom: {
      kind: asString(payload.createdFrom.kind),
    },
  };
}

export function deriveMissionProposalId(normalizedProposalPayload: MissionProposalIdentityPayload): string {
  return sha256(canonicalStringify(normalizedProposalPayload));
}

export function deriveMissionProposalIdFromPayload(payload: MissionProposalIdentityPayload): string {
  return deriveMissionProposalId(normalizeMissionProposalIdentityPayload(payload));
}
