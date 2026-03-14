export const PRODUCT_FACTORY_LIFECYCLE_ACCEPTANCE_CLASSES = [
  'lifecycle_complete',
  'lifecycle_partially_complete',
  'lifecycle_blocked',
  'lifecycle_failed',
  'lifecycle_inconclusive',
] as const;

export const PRODUCT_FACTORY_REPLAY_VALIDATION_CLASSES = [
  'replay_validated',
  'replay_partially_validated',
  'replay_blocked',
  'replay_failed',
  'replay_inconclusive',
] as const;

export const PRODUCT_FACTORY_DOCS_COMPLETENESS_CLASSES = [
  'docs_complete',
  'docs_partially_complete',
  'docs_missing',
  'docs_blocked',
  'docs_inconclusive',
] as const;

export const PRODUCT_FACTORY_RELEASE_HARDENING_CLASSES = [
  'hardened',
  'partially_hardened',
  'blocked',
  'failed',
  'inconclusive',
] as const;

export const PRODUCT_FACTORY_RELEASE_STATUSES = [
  'draft',
  'validating',
  'acceptance_ready',
  'blocked',
  'failed',
  'closed',
  'inconclusive',
] as const;

export const PRODUCT_FACTORY_RELEASE_OUTCOMES = [
  'not_ready',
  'partially_ready',
  'acceptance_ready',
  'blocked',
  'failed',
  'closed',
  'inconclusive',
] as const;

export const PRODUCT_FACTORY_RELEASE_HISTORY_EVENT_TYPES = [
  'product_factory_release_acceptance_record_created',
  'product_factory_lifecycle_acceptance_recorded',
  'product_factory_replay_validation_recorded',
  'product_factory_docs_completeness_recorded',
  'product_factory_release_hardening_recorded',
  'product_factory_release_materialized',
  'product_factory_release_failed',
  'product_factory_release_closed',
] as const;

export const PRODUCT_FACTORY_RELEASE_REQUIRED_DOCUMENT_IDS = [
  'docs/architecture/product-factory-release-closeout-and-acceptance.md',
  'docs/runbooks/product-factory-release-closeout-operations.md',
] as const;

export type ProductFactoryLifecycleAcceptanceClass = typeof PRODUCT_FACTORY_LIFECYCLE_ACCEPTANCE_CLASSES[number];
export type ProductFactoryReplayValidationClass = typeof PRODUCT_FACTORY_REPLAY_VALIDATION_CLASSES[number];
export type ProductFactoryDocsCompletenessClass = typeof PRODUCT_FACTORY_DOCS_COMPLETENESS_CLASSES[number];
export type ProductFactoryReleaseHardeningClass = typeof PRODUCT_FACTORY_RELEASE_HARDENING_CLASSES[number];
export type ProductFactoryReleaseStatus = typeof PRODUCT_FACTORY_RELEASE_STATUSES[number];
export type ProductFactoryReleaseOutcome = typeof PRODUCT_FACTORY_RELEASE_OUTCOMES[number];
export type ProductFactoryReleaseHistoryEventType = typeof PRODUCT_FACTORY_RELEASE_HISTORY_EVENT_TYPES[number];
export type ProductFactoryRequiredDocumentId = typeof PRODUCT_FACTORY_RELEASE_REQUIRED_DOCUMENT_IDS[number];

export type ProductFactoryReleaseState = 'accepted' | 'partial' | 'blocked' | 'failed' | 'inconclusive';

export type ProductFactoryReleaseAcceptanceRecord = {
  productFactoryReleaseAcceptanceRecordId: string;
  releaseTrack: string;
  coveredLayerIds: string[];
  lifecycleAcceptanceId: string;
  replayValidationId: string;
  docsCompletenessId: string;
  releaseHardeningId: string;
  status: ProductFactoryReleaseStatus;
  outcome: ProductFactoryReleaseOutcome;
};

export type ProductFactoryLifecycleAcceptance = {
  productFactoryLifecycleAcceptanceId: string;
  productFactoryReleaseAcceptanceRecordId: string;
  coveredSubsystemIds: string[];
  acceptanceClass: ProductFactoryLifecycleAcceptanceClass;
  reasonTokens: string[];
  state: ProductFactoryReleaseState;
};

export type ProductFactoryReplayValidation = {
  productFactoryReplayValidationId: string;
  productFactoryReleaseAcceptanceRecordId: string;
  validatedSubsystemIds: string[];
  validationClass: ProductFactoryReplayValidationClass;
  reasonTokens: string[];
  state: ProductFactoryReleaseState;
};

export type ProductFactoryDocsCompleteness = {
  productFactoryDocsCompletenessId: string;
  productFactoryReleaseAcceptanceRecordId: string;
  requiredDocumentIds: string[];
  presentDocumentIds: string[];
  completenessClass: ProductFactoryDocsCompletenessClass;
  reasonTokens: string[];
  state: ProductFactoryReleaseState;
};

export type ProductFactoryReleaseHardening = {
  productFactoryReleaseHardeningId: string;
  productFactoryReleaseAcceptanceRecordId: string;
  hardeningClass: ProductFactoryReleaseHardeningClass;
  reasonTokens: string[];
  state: ProductFactoryReleaseState;
};

export type ProductFactoryReleaseHistoryEvent = {
  productFactoryReleaseAcceptanceRecordId: string;
  releaseTrack: string;
  eventType: ProductFactoryReleaseHistoryEventType;
  payloadHash: string;
  payload: Record<string, unknown>;
};

export type ProductFactoryReleaseLayerSummary = {
  layerId: string;
  layerClass:
    | 'product_spec'
    | 'engineering_plan'
    | 'task_graph'
    | 'codex_packet'
    | 'repo_scaffold'
    | 'build_run'
    | 'build_evidence'
    | 'commerce_intent';
  status: string;
  state: ProductFactoryReleaseState;
  reasonTokens: string[];
};

export type ProductFactoryReleaseProjection = {
  productFactoryReleaseAcceptanceRecordId: string;
  releaseTrack: string;
  coveredLayerSummaries: ProductFactoryReleaseLayerSummary[];
  lifecycleAcceptanceSummary: ProductFactoryLifecycleAcceptance;
  replayValidationSummary: ProductFactoryReplayValidation;
  docsCompletenessSummary: ProductFactoryDocsCompleteness;
  releaseHardeningSummary: ProductFactoryReleaseHardening;
  status: ProductFactoryReleaseStatus;
  outcome: ProductFactoryReleaseOutcome;
  releaseHistory: ProductFactoryReleaseHistoryEvent[];
};

export type ProductFactoryReleaseMaterializationSummary = {
  productFactoryReleaseAcceptanceRecordId: string;
  dirPath: string;
  statusPath: string;
  lifecycleAcceptancePath: string;
  replayValidationPath: string;
  docsCompletenessPath: string;
  releaseHardeningPath: string;
  historyPath: string;
  outcomePath: string;
  reportJsonPath: string;
  reportMarkdownPath: string;
};

export type ProductFactoryReleaseCreateSummary = {
  productFactoryReleaseAcceptanceRecordId: string;
  releaseTrack: string;
};
