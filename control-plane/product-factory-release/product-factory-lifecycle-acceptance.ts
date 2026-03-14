import { deriveProductFactoryLifecycleAcceptanceId } from './product-factory-release-acceptance-identity.ts';
import type {
  ProductFactoryLifecycleAcceptance,
  ProductFactoryReleaseLayerSummary,
  ProductFactoryReleaseState,
} from './product-factory-release-acceptance-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function toLifecycleState(acceptanceClass: ProductFactoryLifecycleAcceptance['acceptanceClass']): ProductFactoryReleaseState {
  if (acceptanceClass === 'lifecycle_complete') {
    return 'accepted';
  }
  if (acceptanceClass === 'lifecycle_partially_complete') {
    return 'partial';
  }
  if (acceptanceClass === 'lifecycle_blocked') {
    return 'blocked';
  }
  if (acceptanceClass === 'lifecycle_failed') {
    return 'failed';
  }
  return 'inconclusive';
}

export function deriveProductFactoryLifecycleAcceptance(input: {
  productFactoryReleaseAcceptanceRecordId: string;
  coveredLayerSummaries: ProductFactoryReleaseLayerSummary[];
}): ProductFactoryLifecycleAcceptance {
  const coveredSubsystemIds = uniqueSorted(input.coveredLayerSummaries.map((entry) => entry.layerId));
  const states = input.coveredLayerSummaries.map((entry) => entry.state);
  const reasonTokens = uniqueSorted(input.coveredLayerSummaries.flatMap((entry) => entry.reasonTokens));

  let acceptanceClass: ProductFactoryLifecycleAcceptance['acceptanceClass'] = 'lifecycle_inconclusive';

  if (states.includes('failed')) {
    acceptanceClass = 'lifecycle_failed';
  } else if (states.includes('blocked')) {
    acceptanceClass = 'lifecycle_blocked';
  } else if (states.length > 0 && states.every((entry) => entry === 'accepted')) {
    acceptanceClass = 'lifecycle_complete';
  } else if (states.some((entry) => entry === 'accepted' || entry === 'partial')) {
    acceptanceClass = 'lifecycle_partially_complete';
  }

  const normalizedReasonTokens = uniqueSorted([
    ...reasonTokens,
    acceptanceClass,
  ]);

  return {
    productFactoryLifecycleAcceptanceId: deriveProductFactoryLifecycleAcceptanceId({
      productFactoryReleaseAcceptanceRecordId: input.productFactoryReleaseAcceptanceRecordId,
      coveredSubsystemIds,
      acceptanceClass,
      reasonTokens: normalizedReasonTokens,
    }),
    productFactoryReleaseAcceptanceRecordId: input.productFactoryReleaseAcceptanceRecordId,
    coveredSubsystemIds,
    acceptanceClass,
    reasonTokens: normalizedReasonTokens,
    state: toLifecycleState(acceptanceClass),
  };
}
