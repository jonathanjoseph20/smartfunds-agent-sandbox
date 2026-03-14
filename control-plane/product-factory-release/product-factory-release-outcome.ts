import type {
  ProductFactoryDocsCompleteness,
  ProductFactoryLifecycleAcceptance,
  ProductFactoryReleaseHardening,
  ProductFactoryReleaseOutcome,
  ProductFactoryReleaseStatus,
  ProductFactoryReplayValidation,
} from './product-factory-release-acceptance-types.ts';

export function deriveProductFactoryReleaseOutcome(input: {
  status: ProductFactoryReleaseStatus;
  lifecycleAcceptance: ProductFactoryLifecycleAcceptance;
  replayValidation: ProductFactoryReplayValidation;
  docsCompleteness: ProductFactoryDocsCompleteness;
  releaseHardening: ProductFactoryReleaseHardening;
  commerceState: 'accepted' | 'partial' | 'blocked' | 'failed' | 'inconclusive';
}): ProductFactoryReleaseOutcome {
  if (input.status === 'closed') {
    return 'closed';
  }

  if (
    input.status === 'failed'
    || input.lifecycleAcceptance.state === 'failed'
    || input.replayValidation.state === 'failed'
    || input.docsCompleteness.state === 'failed'
    || input.releaseHardening.state === 'failed'
    || input.commerceState === 'failed'
  ) {
    return 'failed';
  }

  if (
    input.status === 'blocked'
    || input.lifecycleAcceptance.state === 'blocked'
    || input.replayValidation.state === 'blocked'
    || input.docsCompleteness.state === 'blocked'
    || input.releaseHardening.state === 'blocked'
    || input.commerceState === 'blocked'
  ) {
    return 'blocked';
  }

  if (input.status === 'acceptance_ready') {
    return 'acceptance_ready';
  }

  const hasPartial = input.lifecycleAcceptance.state === 'partial'
    || input.replayValidation.state === 'partial'
    || input.docsCompleteness.state === 'partial'
    || input.releaseHardening.state === 'partial'
    || input.commerceState === 'partial';

  if (hasPartial) {
    return 'partially_ready';
  }

  const allInconclusive = input.lifecycleAcceptance.state === 'inconclusive'
    && input.replayValidation.state === 'inconclusive'
    && input.docsCompleteness.state === 'inconclusive'
    && input.releaseHardening.state === 'inconclusive'
    && input.commerceState === 'inconclusive';

  if (allInconclusive) {
    return 'inconclusive';
  }

  return 'not_ready';
}
