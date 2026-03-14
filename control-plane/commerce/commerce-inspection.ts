import {
  createCommerceManager,
  type CommerceManager,
} from './commerce-manager.ts';
import {
  createCommerceMaterializer,
  type CommerceMaterializer,
} from './commerce-materializer.ts';
import type { ChargeIntentCreateInput, PaymentReceiptRecordInput } from './charge-intent-types.ts';

export function createCommerceInspection(options: {
  manager?: CommerceManager;
  materializer?: CommerceMaterializer;
  commerceFilePath?: string;
  historyFilePath?: string;
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
  artifactsRoot?: string;
} = {}) {
  const manager = options.manager ?? createCommerceManager({
    commerceFilePath: options.commerceFilePath,
    historyFilePath: options.historyFilePath,
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

  const materializer = options.materializer ?? createCommerceMaterializer({
    manager,
    artifactsRoot: options.artifactsRoot,
    commerceFilePath: options.commerceFilePath,
    historyFilePath: options.historyFilePath,
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

  function createIntent(input: ChargeIntentCreateInput) {
    return manager.createChargeIntent(input);
  }

  function recordReceipt(input: PaymentReceiptRecordInput) {
    return manager.recordPaymentReceipt(input);
  }

  function listChargeIntents() {
    return manager.listCommerceProjections();
  }

  function inspectChargeIntent(chargeIntentId: string) {
    return manager.deriveCommerceProjection(chargeIntentId);
  }

  function inspectRailBindings(chargeIntentId: string) {
    return manager.deriveCommerceProjection(chargeIntentId).railBindingSummaries;
  }

  function inspectRailEligibility(chargeIntentId: string) {
    return manager.deriveCommerceProjection(chargeIntentId).railEligibilitySummaries;
  }

  function inspectPaymentReceipts(chargeIntentId: string) {
    return manager.deriveCommerceProjection(chargeIntentId).paymentReceiptSummaries;
  }

  function inspectSettlementLogs(chargeIntentId: string) {
    return manager.deriveCommerceProjection(chargeIntentId).settlementLogSummaries;
  }

  function inspectCommerceHistory(chargeIntentId: string) {
    return manager.historyStore.listCommerceEvents(chargeIntentId);
  }

  function inspectCommerceStatus(chargeIntentId: string) {
    const projection = manager.deriveCommerceProjection(chargeIntentId);
    return {
      chargeIntentId: projection.chargeIntentId,
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      status: projection.status,
    };
  }

  function inspectCommerceOutcome(chargeIntentId: string) {
    const projection = manager.deriveCommerceProjection(chargeIntentId);
    return {
      chargeIntentId: projection.chargeIntentId,
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      outcome: projection.outcome,
    };
  }

  function materializeCommerce(chargeIntentId: string) {
    return materializer.materializeCommerce(chargeIntentId);
  }

  return {
    createIntent,
    recordReceipt,
    listChargeIntents,
    inspectChargeIntent,
    inspectRailBindings,
    inspectRailEligibility,
    inspectPaymentReceipts,
    inspectSettlementLogs,
    inspectCommerceHistory,
    inspectCommerceStatus,
    inspectCommerceOutcome,
    materializeCommerce,
  };
}

export type CommerceInspection = ReturnType<typeof createCommerceInspection>;
