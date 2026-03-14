import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import type {
  ProductFactoryDocsCompleteness,
  ProductFactoryLifecycleAcceptance,
  ProductFactoryReleaseAcceptanceRecord,
  ProductFactoryReleaseHardening,
  ProductFactoryReplayValidation,
} from './product-factory-release-acceptance-types.ts';

function normalizeString(value: string): string {
  return value.trim().replace(/\\/g, '/');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => normalizeString(entry)).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function normalizeProductFactoryReleaseAcceptanceRecordIdentityPayload(payload: {
  releaseTrack: string;
  coveredLayerIds: string[];
}) {
  return {
    releaseTrack: normalizeString(payload.releaseTrack),
    coveredLayerIds: uniqueSorted(payload.coveredLayerIds),
  };
}

export function deriveProductFactoryReleaseAcceptanceRecordId(payload: {
  releaseTrack: string;
  coveredLayerIds: string[];
}): string {
  return sha256(canonicalStringify(normalizeProductFactoryReleaseAcceptanceRecordIdentityPayload(payload)));
}

export function deriveProductFactoryLifecycleAcceptanceId(payload: {
  productFactoryReleaseAcceptanceRecordId: string;
  coveredSubsystemIds: string[];
  acceptanceClass: string;
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    productFactoryReleaseAcceptanceRecordId: normalizeString(payload.productFactoryReleaseAcceptanceRecordId),
    coveredSubsystemIds: uniqueSorted(payload.coveredSubsystemIds),
    acceptanceClass: normalizeString(payload.acceptanceClass),
    reasonTokens: uniqueSorted(payload.reasonTokens),
  }));
}

export function deriveProductFactoryReplayValidationId(payload: {
  productFactoryReleaseAcceptanceRecordId: string;
  validatedSubsystemIds: string[];
  validationClass: string;
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    productFactoryReleaseAcceptanceRecordId: normalizeString(payload.productFactoryReleaseAcceptanceRecordId),
    validatedSubsystemIds: uniqueSorted(payload.validatedSubsystemIds),
    validationClass: normalizeString(payload.validationClass),
    reasonTokens: uniqueSorted(payload.reasonTokens),
  }));
}

export function deriveProductFactoryDocsCompletenessId(payload: {
  productFactoryReleaseAcceptanceRecordId: string;
  requiredDocumentIds: string[];
  presentDocumentIds: string[];
  completenessClass: string;
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    productFactoryReleaseAcceptanceRecordId: normalizeString(payload.productFactoryReleaseAcceptanceRecordId),
    requiredDocumentIds: uniqueSorted(payload.requiredDocumentIds),
    presentDocumentIds: uniqueSorted(payload.presentDocumentIds),
    completenessClass: normalizeString(payload.completenessClass),
    reasonTokens: uniqueSorted(payload.reasonTokens),
  }));
}

export function deriveProductFactoryReleaseHardeningId(payload: {
  productFactoryReleaseAcceptanceRecordId: string;
  hardeningClass: string;
  reasonTokens: string[];
}): string {
  return sha256(canonicalStringify({
    productFactoryReleaseAcceptanceRecordId: normalizeString(payload.productFactoryReleaseAcceptanceRecordId),
    hardeningClass: normalizeString(payload.hardeningClass),
    reasonTokens: uniqueSorted(payload.reasonTokens),
  }));
}

export function computeProductFactoryReleaseAcceptanceRecordSemanticHash(
  record: ProductFactoryReleaseAcceptanceRecord,
): string {
  return sha256(canonicalStringify({
    releaseTrack: normalizeString(record.releaseTrack),
    coveredLayerIds: uniqueSorted(record.coveredLayerIds),
    lifecycleAcceptanceId: normalizeString(record.lifecycleAcceptanceId),
    replayValidationId: normalizeString(record.replayValidationId),
    docsCompletenessId: normalizeString(record.docsCompletenessId),
    releaseHardeningId: normalizeString(record.releaseHardeningId),
    status: normalizeString(record.status),
    outcome: normalizeString(record.outcome),
  }));
}

export function computeProductFactoryLifecycleAcceptanceSemanticHash(
  lifecycle: ProductFactoryLifecycleAcceptance,
): string {
  return sha256(canonicalStringify({
    productFactoryReleaseAcceptanceRecordId: lifecycle.productFactoryReleaseAcceptanceRecordId,
    coveredSubsystemIds: uniqueSorted(lifecycle.coveredSubsystemIds),
    acceptanceClass: lifecycle.acceptanceClass,
    reasonTokens: uniqueSorted(lifecycle.reasonTokens),
    state: lifecycle.state,
  }));
}

export function computeProductFactoryReplayValidationSemanticHash(
  replayValidation: ProductFactoryReplayValidation,
): string {
  return sha256(canonicalStringify({
    productFactoryReleaseAcceptanceRecordId: replayValidation.productFactoryReleaseAcceptanceRecordId,
    validatedSubsystemIds: uniqueSorted(replayValidation.validatedSubsystemIds),
    validationClass: replayValidation.validationClass,
    reasonTokens: uniqueSorted(replayValidation.reasonTokens),
    state: replayValidation.state,
  }));
}

export function computeProductFactoryDocsCompletenessSemanticHash(
  docsCompleteness: ProductFactoryDocsCompleteness,
): string {
  return sha256(canonicalStringify({
    productFactoryReleaseAcceptanceRecordId: docsCompleteness.productFactoryReleaseAcceptanceRecordId,
    requiredDocumentIds: uniqueSorted(docsCompleteness.requiredDocumentIds),
    presentDocumentIds: uniqueSorted(docsCompleteness.presentDocumentIds),
    completenessClass: docsCompleteness.completenessClass,
    reasonTokens: uniqueSorted(docsCompleteness.reasonTokens),
    state: docsCompleteness.state,
  }));
}

export function computeProductFactoryReleaseHardeningSemanticHash(
  releaseHardening: ProductFactoryReleaseHardening,
): string {
  return sha256(canonicalStringify({
    productFactoryReleaseAcceptanceRecordId: releaseHardening.productFactoryReleaseAcceptanceRecordId,
    hardeningClass: releaseHardening.hardeningClass,
    reasonTokens: uniqueSorted(releaseHardening.reasonTokens),
    state: releaseHardening.state,
  }));
}
