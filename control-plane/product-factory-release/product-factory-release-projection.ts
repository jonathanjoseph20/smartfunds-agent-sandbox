import { canonicalStringify } from '../finance/determinism.ts';

import {
  deriveProductFactoryDocsCompleteness,
} from './product-factory-docs-completeness.ts';
import {
  deriveProductFactoryLifecycleAcceptance,
} from './product-factory-lifecycle-acceptance.ts';
import {
  deriveProductFactoryReleaseHardening,
} from './product-factory-release-hardening.ts';
import {
  deriveProductFactoryReleaseOutcome,
} from './product-factory-release-outcome.ts';
import {
  deriveProductFactoryReleaseStatus,
} from './product-factory-release-status.ts';
import {
  deriveProductFactoryReplayValidation,
  type ReplayCheck,
} from './product-factory-replay-validation.ts';
import type {
  ProductFactoryReleaseAcceptanceRecord,
  ProductFactoryReleaseHistoryEvent,
  ProductFactoryReleaseLayerSummary,
  ProductFactoryReleaseProjection,
} from './product-factory-release-acceptance-types.ts';
import { toProductFactoryReleasePayloadHash } from './product-factory-release-history-store.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim().replace(/\\/g, '/')).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function normalizeLayerSummaries(summaries: ProductFactoryReleaseLayerSummary[]): ProductFactoryReleaseLayerSummary[] {
  return [...summaries]
    .map((entry) => ({
      ...entry,
      layerId: entry.layerId.trim(),
      status: entry.status.trim(),
      reasonTokens: uniqueSorted(entry.reasonTokens),
    }))
    .sort((left, right) => left.layerId.localeCompare(right.layerId));
}

function normalizeHistory(events: ProductFactoryReleaseHistoryEvent[]): ProductFactoryReleaseHistoryEvent[] {
  return [...events]
    .map((entry) => ({
      ...entry,
      payload: JSON.parse(canonicalStringify(entry.payload)) as Record<string, unknown>,
    }))
    .sort((left, right) => {
      const byType = left.eventType.localeCompare(right.eventType);
      if (byType !== 0) {
        return byType;
      }

      return left.payloadHash.localeCompare(right.payloadHash);
    });
}

function deriveCommerceState(layerSummaries: ProductFactoryReleaseLayerSummary[]):
  'accepted' | 'partial' | 'blocked' | 'failed' | 'inconclusive' {
  const commerceSummary = layerSummaries.find((entry) => entry.layerClass === 'commerce_intent');
  return commerceSummary?.state ?? 'inconclusive';
}

export function projectProductFactoryRelease(input: {
  acceptanceRecord: ProductFactoryReleaseAcceptanceRecord;
  coveredLayerSummaries: ProductFactoryReleaseLayerSummary[];
  replayChecks: ReplayCheck[];
  requiredDocumentIds: string[];
  presentDocumentIds: string[];
  releaseHistory: ProductFactoryReleaseHistoryEvent[];
}): ProductFactoryReleaseProjection {
  const coveredLayerSummaries = normalizeLayerSummaries(input.coveredLayerSummaries);
  const releaseHistory = normalizeHistory(input.releaseHistory);
  const commerceState = deriveCommerceState(coveredLayerSummaries);

  const lifecycleAcceptanceSummary = deriveProductFactoryLifecycleAcceptance({
    productFactoryReleaseAcceptanceRecordId: input.acceptanceRecord.productFactoryReleaseAcceptanceRecordId,
    coveredLayerSummaries,
  });

  const replayValidationSummary = deriveProductFactoryReplayValidation({
    productFactoryReleaseAcceptanceRecordId: input.acceptanceRecord.productFactoryReleaseAcceptanceRecordId,
    checks: input.replayChecks,
  });

  const docsCompletenessSummary = deriveProductFactoryDocsCompleteness({
    productFactoryReleaseAcceptanceRecordId: input.acceptanceRecord.productFactoryReleaseAcceptanceRecordId,
    requiredDocumentIds: input.requiredDocumentIds,
    presentDocumentIds: input.presentDocumentIds,
  });

  const releaseHardeningSummary = deriveProductFactoryReleaseHardening({
    productFactoryReleaseAcceptanceRecordId: input.acceptanceRecord.productFactoryReleaseAcceptanceRecordId,
    lifecycleAcceptance: lifecycleAcceptanceSummary,
    replayValidation: replayValidationSummary,
    docsCompleteness: docsCompletenessSummary,
    commerceState,
    releaseFailed: releaseHistory.some((entry) => entry.eventType === 'product_factory_release_failed'),
  });

  const status = deriveProductFactoryReleaseStatus({
    lifecycleAcceptance: lifecycleAcceptanceSummary,
    replayValidation: replayValidationSummary,
    docsCompleteness: docsCompletenessSummary,
    releaseHardening: releaseHardeningSummary,
    commerceState,
    history: releaseHistory,
  });

  const outcome = deriveProductFactoryReleaseOutcome({
    status,
    lifecycleAcceptance: lifecycleAcceptanceSummary,
    replayValidation: replayValidationSummary,
    docsCompleteness: docsCompletenessSummary,
    releaseHardening: releaseHardeningSummary,
    commerceState,
  });

  return {
    productFactoryReleaseAcceptanceRecordId: input.acceptanceRecord.productFactoryReleaseAcceptanceRecordId,
    releaseTrack: input.acceptanceRecord.releaseTrack,
    coveredLayerSummaries,
    lifecycleAcceptanceSummary,
    replayValidationSummary,
    docsCompletenessSummary,
    releaseHardeningSummary,
    status,
    outcome,
    releaseHistory,
  };
}

export function deriveProductFactoryReleaseProjectionEvents(input: {
  projection: ProductFactoryReleaseProjection;
}): ProductFactoryReleaseHistoryEvent[] {
  const payloads = [
    {
      eventType: 'product_factory_lifecycle_acceptance_recorded' as const,
      payload: {
        productFactoryLifecycleAcceptanceId: input.projection.lifecycleAcceptanceSummary.productFactoryLifecycleAcceptanceId,
        acceptanceClass: input.projection.lifecycleAcceptanceSummary.acceptanceClass,
      },
    },
    {
      eventType: 'product_factory_replay_validation_recorded' as const,
      payload: {
        productFactoryReplayValidationId: input.projection.replayValidationSummary.productFactoryReplayValidationId,
        validationClass: input.projection.replayValidationSummary.validationClass,
      },
    },
    {
      eventType: 'product_factory_docs_completeness_recorded' as const,
      payload: {
        productFactoryDocsCompletenessId: input.projection.docsCompletenessSummary.productFactoryDocsCompletenessId,
        completenessClass: input.projection.docsCompletenessSummary.completenessClass,
        presentDocumentIds: input.projection.docsCompletenessSummary.presentDocumentIds,
      },
    },
    {
      eventType: 'product_factory_release_hardening_recorded' as const,
      payload: {
        productFactoryReleaseHardeningId: input.projection.releaseHardeningSummary.productFactoryReleaseHardeningId,
        hardeningClass: input.projection.releaseHardeningSummary.hardeningClass,
        status: input.projection.status,
        outcome: input.projection.outcome,
      },
    },
  ];

  return payloads.map((entry) => ({
    productFactoryReleaseAcceptanceRecordId: input.projection.productFactoryReleaseAcceptanceRecordId,
    releaseTrack: input.projection.releaseTrack,
    eventType: entry.eventType,
    payloadHash: toProductFactoryReleasePayloadHash(entry.payload),
    payload: JSON.parse(canonicalStringify(entry.payload)) as Record<string, unknown>,
  }));
}
