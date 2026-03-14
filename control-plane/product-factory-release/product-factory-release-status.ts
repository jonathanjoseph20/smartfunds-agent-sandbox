import type {
  ProductFactoryDocsCompleteness,
  ProductFactoryLifecycleAcceptance,
  ProductFactoryReleaseHardening,
  ProductFactoryReleaseHistoryEvent,
  ProductFactoryReleaseStatus,
  ProductFactoryReplayValidation,
} from './product-factory-release-acceptance-types.ts';

export function deriveProductFactoryReleaseStatus(input: {
  lifecycleAcceptance: ProductFactoryLifecycleAcceptance;
  replayValidation: ProductFactoryReplayValidation;
  docsCompleteness: ProductFactoryDocsCompleteness;
  releaseHardening: ProductFactoryReleaseHardening;
  commerceState: 'accepted' | 'partial' | 'blocked' | 'failed' | 'inconclusive';
  history: ProductFactoryReleaseHistoryEvent[];
}): ProductFactoryReleaseStatus {
  const eventTypes = new Set(input.history.map((entry) => entry.eventType));
  if (eventTypes.has('product_factory_release_closed')) {
    return 'closed';
  }

  if (
    eventTypes.has('product_factory_release_failed')
    || input.lifecycleAcceptance.state === 'failed'
    || input.replayValidation.state === 'failed'
    || input.docsCompleteness.state === 'failed'
    || input.releaseHardening.state === 'failed'
    || input.commerceState === 'failed'
  ) {
    return 'failed';
  }

  if (
    input.lifecycleAcceptance.state === 'blocked'
    || input.replayValidation.state === 'blocked'
    || input.docsCompleteness.state === 'blocked'
    || input.releaseHardening.state === 'blocked'
    || input.commerceState === 'blocked'
  ) {
    return 'blocked';
  }

  const hasValidationEvents = eventTypes.has('product_factory_lifecycle_acceptance_recorded')
    || eventTypes.has('product_factory_replay_validation_recorded')
    || eventTypes.has('product_factory_docs_completeness_recorded')
    || eventTypes.has('product_factory_release_hardening_recorded');

  if (!hasValidationEvents) {
    return 'draft';
  }

  const acceptanceReady = input.lifecycleAcceptance.acceptanceClass === 'lifecycle_complete'
    && input.replayValidation.validationClass === 'replay_validated'
    && input.docsCompleteness.completenessClass === 'docs_complete'
    && input.releaseHardening.hardeningClass === 'hardened'
    && input.commerceState === 'accepted';

  if (acceptanceReady) {
    return 'acceptance_ready';
  }

  const allInconclusive = input.lifecycleAcceptance.state === 'inconclusive'
    && input.replayValidation.state === 'inconclusive'
    && input.docsCompleteness.state === 'inconclusive'
    && input.releaseHardening.state === 'inconclusive'
    && input.commerceState === 'inconclusive';

  if (allInconclusive) {
    return 'inconclusive';
  }

  return 'validating';
}
