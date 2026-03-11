import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type { DeliverableDescriptor, SourceReference } from './mission-types.ts';

export interface MissionIdentityPayload {
  missionType: string;
  objective: string;
  requestedDeliverables: DeliverableDescriptor[];
  sourceReferences: SourceReference[];
  linkedActionPlanIds: string[];
  founderInstructions: string;
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

export function normalizeMissionIdentityPayload(payload: MissionIdentityPayload): MissionIdentityPayload {
  return {
    missionType: asString(payload.missionType),
    objective: asString(payload.objective),
    requestedDeliverables: normalizeDeliverables(payload.requestedDeliverables),
    sourceReferences: normalizeSourceReferences(payload.sourceReferences),
    linkedActionPlanIds: uniqueSorted(payload.linkedActionPlanIds),
    founderInstructions: asString(payload.founderInstructions),
    createdFrom: {
      kind: asString(payload.createdFrom.kind),
    },
  };
}

export function deriveMissionId(normalizedMissionPayload: MissionIdentityPayload): string {
  return sha256(canonicalStringify(normalizedMissionPayload));
}

export function deriveMissionIdFromPayload(payload: MissionIdentityPayload): string {
  return deriveMissionId(normalizeMissionIdentityPayload(payload));
}
