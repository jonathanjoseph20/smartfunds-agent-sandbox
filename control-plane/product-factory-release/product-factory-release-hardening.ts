import {
  deriveProductFactoryReleaseHardeningId,
} from './product-factory-release-acceptance-identity.ts';
import type {
  ProductFactoryDocsCompleteness,
  ProductFactoryLifecycleAcceptance,
  ProductFactoryReleaseHardening,
  ProductFactoryReleaseState,
  ProductFactoryReplayValidation,
} from './product-factory-release-acceptance-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => entry.trim()).filter((entry) => entry.length > 0)))
    .sort((left, right) => left.localeCompare(right));
}

function toHardeningState(hardeningClass: ProductFactoryReleaseHardening['hardeningClass']): ProductFactoryReleaseState {
  if (hardeningClass === 'hardened') {
    return 'accepted';
  }
  if (hardeningClass === 'partially_hardened') {
    return 'partial';
  }
  if (hardeningClass === 'blocked') {
    return 'blocked';
  }
  if (hardeningClass === 'failed') {
    return 'failed';
  }
  return 'inconclusive';
}

export function deriveProductFactoryReleaseHardening(input: {
  productFactoryReleaseAcceptanceRecordId: string;
  lifecycleAcceptance: ProductFactoryLifecycleAcceptance;
  replayValidation: ProductFactoryReplayValidation;
  docsCompleteness: ProductFactoryDocsCompleteness;
  commerceState: ProductFactoryReleaseState;
  releaseFailed: boolean;
}): ProductFactoryReleaseHardening {
  const postureStates = [
    input.lifecycleAcceptance.state,
    input.replayValidation.state,
    input.docsCompleteness.state,
    input.commerceState,
  ];

  let hardeningClass: ProductFactoryReleaseHardening['hardeningClass'] = 'inconclusive';
  if (input.releaseFailed || postureStates.includes('failed')) {
    hardeningClass = 'failed';
  } else if (postureStates.includes('blocked')) {
    hardeningClass = 'blocked';
  } else if (postureStates.every((entry) => entry === 'accepted')) {
    hardeningClass = 'hardened';
  } else if (postureStates.some((entry) => entry === 'accepted' || entry === 'partial')) {
    hardeningClass = 'partially_hardened';
  }

  const reasonTokens = uniqueSorted([
    ...input.lifecycleAcceptance.reasonTokens,
    ...input.replayValidation.reasonTokens,
    ...input.docsCompleteness.reasonTokens,
    `commerce_state:${input.commerceState}`,
    hardeningClass,
  ]);

  return {
    productFactoryReleaseHardeningId: deriveProductFactoryReleaseHardeningId({
      productFactoryReleaseAcceptanceRecordId: input.productFactoryReleaseAcceptanceRecordId,
      hardeningClass,
      reasonTokens,
    }),
    productFactoryReleaseAcceptanceRecordId: input.productFactoryReleaseAcceptanceRecordId,
    hardeningClass,
    reasonTokens,
    state: toHardeningState(hardeningClass),
  };
}
