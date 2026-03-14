import {
  createProductFactoryReleaseManager,
  type ProductFactoryReleaseManager,
} from './product-factory-release-manager.ts';
import {
  createProductFactoryReleaseMaterializer,
  type ProductFactoryReleaseMaterializer,
} from './product-factory-release-materializer.ts';

export function createProductFactoryReleaseInspection(options: {
  manager?: ProductFactoryReleaseManager;
  materializer?: ProductFactoryReleaseMaterializer;
  recordsFilePath?: string;
  historyFilePath?: string;
  releaseArtifactsRoot?: string;
  commerceFilePath?: string;
  commerceHistoryFilePath?: string;
  evidenceBundlesFilePath?: string;
  evidenceHistoryFilePath?: string;
  runsFilePath?: string;
  runHistoryFilePath?: string;
  packetsFilePath?: string;
  packetHistoryFilePath?: string;
  bundlesFilePath?: string;
  bundleHistoryFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
  specsFilePath?: string;
  specHistoryFilePath?: string;
} = {}) {
  const manager = options.manager ?? createProductFactoryReleaseManager({
    recordsFilePath: options.recordsFilePath,
    historyFilePath: options.historyFilePath,
    commerceFilePath: options.commerceFilePath,
    commerceHistoryFilePath: options.commerceHistoryFilePath,
    evidenceBundlesFilePath: options.evidenceBundlesFilePath,
    evidenceHistoryFilePath: options.evidenceHistoryFilePath,
    runsFilePath: options.runsFilePath,
    runHistoryFilePath: options.runHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesFilePath: options.bundlesFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
    specsFilePath: options.specsFilePath,
    specHistoryFilePath: options.specHistoryFilePath,
  });

  const materializer = options.materializer ?? createProductFactoryReleaseMaterializer({
    manager,
    artifactsRoot: options.releaseArtifactsRoot,
  });

  function listReleaseAcceptanceRecords() {
    return manager.listReleaseProjections();
  }

  function inspectReleaseAcceptanceRecord(productFactoryReleaseAcceptanceRecordId: string) {
    return manager.deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId);
  }

  function inspectLifecycleAcceptance(productFactoryReleaseAcceptanceRecordId: string) {
    return manager.deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId).lifecycleAcceptanceSummary;
  }

  function inspectReplayValidation(productFactoryReleaseAcceptanceRecordId: string) {
    return manager.deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId).replayValidationSummary;
  }

  function inspectDocsCompleteness(productFactoryReleaseAcceptanceRecordId: string) {
    return manager.deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId).docsCompletenessSummary;
  }

  function inspectReleaseHardening(productFactoryReleaseAcceptanceRecordId: string) {
    return manager.deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId).releaseHardeningSummary;
  }

  function inspectReleaseHistory(productFactoryReleaseAcceptanceRecordId: string) {
    return manager.historyStore.listProductFactoryReleaseEvents(productFactoryReleaseAcceptanceRecordId);
  }

  function inspectReleaseStatus(productFactoryReleaseAcceptanceRecordId: string) {
    const projection = manager.deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId);
    return {
      productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
      releaseTrack: projection.releaseTrack,
      status: projection.status,
    };
  }

  function inspectReleaseOutcome(productFactoryReleaseAcceptanceRecordId: string) {
    const projection = manager.deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId);
    return {
      productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
      releaseTrack: projection.releaseTrack,
      outcome: projection.outcome,
    };
  }

  function createReleaseAcceptance(input: {
    releaseTrack: string;
    chargeIntentId: string;
    presentDocumentIds?: string[];
  }) {
    return manager.createReleaseAcceptanceRecord(input);
  }

  function validateReleaseAcceptance(input: {
    productFactoryReleaseAcceptanceRecordId: string;
    presentDocumentIds?: string[];
  }) {
    return manager.validateReleaseAcceptance(input.productFactoryReleaseAcceptanceRecordId, input.presentDocumentIds ?? []);
  }

  function closeReleaseAcceptance(input: {
    productFactoryReleaseAcceptanceRecordId: string;
  }) {
    return manager.closeReleaseAcceptance(input.productFactoryReleaseAcceptanceRecordId);
  }

  function materializeReleaseAcceptance(input: {
    productFactoryReleaseAcceptanceRecordId: string;
  }) {
    return materializer.materializeRelease(input.productFactoryReleaseAcceptanceRecordId);
  }

  return {
    listReleaseAcceptanceRecords,
    inspectReleaseAcceptanceRecord,
    inspectLifecycleAcceptance,
    inspectReplayValidation,
    inspectDocsCompleteness,
    inspectReleaseHardening,
    inspectReleaseHistory,
    inspectReleaseStatus,
    inspectReleaseOutcome,
    createReleaseAcceptance,
    validateReleaseAcceptance,
    closeReleaseAcceptance,
    materializeReleaseAcceptance,
  };
}

export type ProductFactoryReleaseInspection = ReturnType<typeof createProductFactoryReleaseInspection>;
