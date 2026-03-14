import { deriveProductFactoryReleaseAcceptanceRecordId } from './product-factory-release-acceptance-identity.ts';
import type {
  ProductFactoryReleaseAcceptanceRecord,
  ProductFactoryReleaseOutcome,
  ProductFactoryReleaseStatus,
} from './product-factory-release-acceptance-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

export function createProductFactoryReleaseAcceptanceRecord(input: {
  releaseTrack: string;
  coveredLayerIds: string[];
  lifecycleAcceptanceId: string;
  replayValidationId: string;
  docsCompletenessId: string;
  releaseHardeningId: string;
  status: ProductFactoryReleaseStatus;
  outcome: ProductFactoryReleaseOutcome;
}): ProductFactoryReleaseAcceptanceRecord {
  const normalizedReleaseTrack = input.releaseTrack.trim();
  if (normalizedReleaseTrack.length === 0) {
    throw new Error('PRODUCT_FACTORY_RELEASE_TRACK_REQUIRED');
  }

  const coveredLayerIds = uniqueSorted(input.coveredLayerIds);
  if (coveredLayerIds.length === 0) {
    throw new Error('PRODUCT_FACTORY_COVERED_LAYER_IDS_REQUIRED');
  }

  const productFactoryReleaseAcceptanceRecordId = deriveProductFactoryReleaseAcceptanceRecordId({
    releaseTrack: normalizedReleaseTrack,
    coveredLayerIds,
  });

  return {
    productFactoryReleaseAcceptanceRecordId,
    releaseTrack: normalizedReleaseTrack,
    coveredLayerIds,
    lifecycleAcceptanceId: input.lifecycleAcceptanceId,
    replayValidationId: input.replayValidationId,
    docsCompletenessId: input.docsCompletenessId,
    releaseHardeningId: input.releaseHardeningId,
    status: input.status,
    outcome: input.outcome,
  };
}
