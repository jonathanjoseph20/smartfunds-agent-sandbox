import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  VentureClass,
  VentureDefinition,
  VentureOwnershipModel,
} from './venture-types.ts';

export interface VentureIdentityPayload {
  ventureSlug: string;
  ventureClass: VentureClass;
  ownershipModel: VentureOwnershipModel;
  originMissionIds: string[];
  domainTags: string[];
  productTypeTags: string[];
  linkedEntityIds: string[];
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeSlug(value: string): string {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function normalizeSemanticStringArray(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((entry) => normalizeText(entry))
        .filter((entry) => entry.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function buildVentureIdentityPayload(definition: VentureDefinition): VentureIdentityPayload {
  return {
    ventureSlug: normalizeSlug(definition.ventureSlug),
    ventureClass: definition.ventureClass,
    ownershipModel: definition.ownershipModel,
    originMissionIds: normalizeSemanticStringArray(definition.originMissionIds),
    domainTags: normalizeSemanticStringArray(definition.domainTags),
    productTypeTags: normalizeSemanticStringArray(definition.productTypeTags),
    linkedEntityIds: normalizeSemanticStringArray(definition.linkedEntityIds),
  };
}

export function deriveVentureId(payload: VentureIdentityPayload): string {
  return sha256(canonicalStringify(payload));
}

export function deriveVentureIdFromDefinition(definition: VentureDefinition): string {
  return deriveVentureId(buildVentureIdentityPayload(definition));
}

export function normalizeVentureSlug(value: string): string {
  return normalizeSlug(value);
}
