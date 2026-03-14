import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';
import {
  createBuildEvidenceManager,
  type BuildEvidenceManager,
} from '../build-evidence/build-evidence-manager.ts';
import {
  createBuildExecutionManager,
  type BuildExecutionManager,
} from '../build-runtime/build-execution-manager.ts';
import {
  createCodexExecutionPacketManager,
  type CodexExecutionPacketManager,
} from '../codex/codex-execution-packet-manager.ts';
import {
  createEngineeringPlanManager,
  type EngineeringPlanManager,
} from '../engineering/engineering-plan-manager.ts';
import {
  createProductSpecManager,
  type ProductSpecManager,
} from '../products/product-spec-manager.ts';
import {
  createRepoScaffoldManager,
  type RepoScaffoldManager,
} from '../repo-scaffold/repo-scaffold-manager.ts';
import {
  createImplementationTaskGraphManager,
  type ImplementationTaskGraphManager,
} from '../tasks/task-graph-manager.ts';

import { createChargeIntentRecord, type CommerceUpstreamContext } from './charge-intent-record.ts';
import { createManualPaymentReceipt } from './payment-receipt.ts';
import {
  createCommerceHistoryStore,
  toCommercePayloadHash,
  type CommerceHistoryStore,
} from './commerce-history-store.ts';
import { projectCommerce } from './commerce-projection.ts';
import type {
  ChargeIntent,
  ChargeIntentCreateInput,
  CommerceProjection,
  PaymentReceipt,
  PaymentReceiptRecordInput,
} from './charge-intent-types.ts';

type CommerceStore = {
  chargeIntents: ChargeIntent[];
  manualPaymentReceipts: PaymentReceipt[];
};

const DEFAULT_COMMERCE_FILE = path.join(
  'runtime-data',
  'commerce',
  'commerce-state.json',
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseChargeIntent(value: unknown): ChargeIntent {
  if (!isRecord(value)) {
    throw new Error('COMMERCE_INVALID_CHARGE_INTENT');
  }

  const chargeIntentId = asString(value.chargeIntentId);
  const buildEvidenceBundleId = asString(value.buildEvidenceBundleId);
  const runId = asString(value.runId);
  const packetId = asString(value.packetId);
  const bundleId = asString(value.bundleId);
  const graphId = asString(value.graphId);
  const taskId = asString(value.taskId);
  const planId = asString(value.planId);
  const productSpecId = asString(value.productSpecId);
  const monetizationClass = asString(value.monetizationClass);
  const amount = asString(value.amount);
  const currency = asString(value.currency);
  const payTo = asString(value.payTo);
  const status = asString(value.status);
  const outcome = asString(value.outcome);

  if (!chargeIntentId || !buildEvidenceBundleId || !runId || !packetId || !bundleId || !graphId || !taskId || !planId || !productSpecId
    || !monetizationClass || !amount || !currency || !payTo || !status || !outcome || !Array.isArray(value.railClasses)) {
    throw new Error('COMMERCE_INVALID_CHARGE_INTENT');
  }

  const railClasses = value.railClasses
    .filter((entry): entry is ChargeIntent['railClasses'][number] => typeof entry === 'string')
    .sort((left, right) => left.localeCompare(right));

  return {
    chargeIntentId,
    buildEvidenceBundleId,
    runId,
    packetId,
    bundleId,
    graphId,
    taskId,
    planId,
    productSpecId,
    monetizationClass: monetizationClass as ChargeIntent['monetizationClass'],
    amount,
    currency,
    payTo,
    railClasses,
    status: status as ChargeIntent['status'],
    outcome: outcome as ChargeIntent['outcome'],
  };
}

function parsePaymentReceipt(value: unknown): PaymentReceipt {
  if (!isRecord(value)) {
    throw new Error('COMMERCE_INVALID_PAYMENT_RECEIPT');
  }

  const paymentReceiptId = asString(value.paymentReceiptId);
  const chargeIntentId = asString(value.chargeIntentId);
  const railBindingId = asString(value.railBindingId);
  const receiptClass = asString(value.receiptClass);
  const receiptReference = asString(value.receiptReference);
  const state = asString(value.state);

  if (!paymentReceiptId || !chargeIntentId || !railBindingId || !receiptClass || !receiptReference || !state || !Array.isArray(value.reasonTokens)) {
    throw new Error('COMMERCE_INVALID_PAYMENT_RECEIPT');
  }

  const reasonTokens = value.reasonTokens
    .filter((entry): entry is string => typeof entry === 'string')
    .sort((left, right) => left.localeCompare(right));

  return {
    paymentReceiptId,
    chargeIntentId,
    railBindingId,
    receiptClass: receiptClass as PaymentReceipt['receiptClass'],
    receiptReference,
    reasonTokens,
    state: state as PaymentReceipt['state'],
  };
}

function readStore(filePath: string): CommerceStore {
  if (!fs.existsSync(filePath)) {
    return {
      chargeIntents: [],
      manualPaymentReceipts: [],
    };
  }

  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
  if (!isRecord(parsed)) {
    throw new Error('COMMERCE_INVALID_STORE');
  }

  const chargeIntents = Array.isArray(parsed.chargeIntents)
    ? parsed.chargeIntents.map((entry) => parseChargeIntent(entry)).sort((left, right) => left.chargeIntentId.localeCompare(right.chargeIntentId))
    : [];

  const manualPaymentReceipts = Array.isArray(parsed.manualPaymentReceipts)
    ? parsed.manualPaymentReceipts
      .map((entry) => parsePaymentReceipt(entry))
      .sort((left, right) => left.paymentReceiptId.localeCompare(right.paymentReceiptId))
    : [];

  return {
    chargeIntents,
    manualPaymentReceipts,
  };
}

function writeStore(filePath: string, store: CommerceStore): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${canonicalStringify({
    chargeIntents: [...store.chargeIntents].sort((left, right) => left.chargeIntentId.localeCompare(right.chargeIntentId)),
    manualPaymentReceipts: [...store.manualPaymentReceipts].sort((left, right) => left.paymentReceiptId.localeCompare(right.paymentReceiptId)),
  })}\n`, 'utf8');
}

function toUpstreamContext(input: {
  buildEvidenceBundleId: string;
  buildEvidenceManager: BuildEvidenceManager;
  buildExecutionManager: BuildExecutionManager;
  packetManager: CodexExecutionPacketManager;
  scaffoldManager: RepoScaffoldManager;
  taskGraphManager: ImplementationTaskGraphManager;
  engineeringPlanManager: EngineeringPlanManager;
  productSpecManager: ProductSpecManager;
}): CommerceUpstreamContext {
  const evidenceBundle = input.buildEvidenceManager.getBuildEvidenceBundle(input.buildEvidenceBundleId);
  const run = input.buildExecutionManager.getBuildExecutionRun(evidenceBundle.runId);
  const packet = input.packetManager.getCodexExecutionPacket(run.packetId);
  input.scaffoldManager.getRepoScaffoldBundle(run.bundleId);
  const taskGraph = input.taskGraphManager.getImplementationTaskGraph(packet.graphId);
  const plan = input.engineeringPlanManager.getEngineeringPlan(taskGraph.planId);
  input.productSpecManager.getProductSpec(plan.specId);

  return {
    buildEvidenceBundleId: evidenceBundle.buildEvidenceBundleId,
    runId: run.runId,
    packetId: packet.packetId,
    bundleId: run.bundleId,
    graphId: packet.graphId,
    taskId: packet.taskId,
    planId: taskGraph.planId,
    productSpecId: plan.specId,
  };
}

export function createCommerceManager(options: {
  commerceFilePath?: string;
  historyStore?: CommerceHistoryStore;
  historyFilePath?: string;
  buildEvidenceManager?: BuildEvidenceManager;
  buildExecutionManager?: BuildExecutionManager;
  packetManager?: CodexExecutionPacketManager;
  scaffoldManager?: RepoScaffoldManager;
  taskGraphManager?: ImplementationTaskGraphManager;
  engineeringPlanManager?: EngineeringPlanManager;
  productSpecManager?: ProductSpecManager;
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
  const commerceFilePath = options.commerceFilePath ?? DEFAULT_COMMERCE_FILE;

  const historyStore = options.historyStore ?? createCommerceHistoryStore({
    historyFilePath: options.historyFilePath,
  });

  const buildEvidenceManager = options.buildEvidenceManager ?? createBuildEvidenceManager({
    bundlesFilePath: options.evidenceBundlesFilePath,
    historyFilePath: options.evidenceHistoryFilePath,
    runsFilePath: options.runsFilePath,
    runHistoryFilePath: options.runHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesRuntimeFilePath: options.bundlesFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const buildExecutionManager = options.buildExecutionManager ?? createBuildExecutionManager({
    runsFilePath: options.runsFilePath,
    historyFilePath: options.runHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesFilePath: options.bundlesFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const packetManager = options.packetManager ?? createCodexExecutionPacketManager({
    packetsFilePath: options.packetsFilePath,
    historyFilePath: options.packetHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const scaffoldManager = options.scaffoldManager ?? createRepoScaffoldManager({
    bundlesFilePath: options.bundlesFilePath,
    historyFilePath: options.bundleHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const taskGraphManager = options.taskGraphManager ?? createImplementationTaskGraphManager({
    taskGraphsFilePath: options.taskGraphsFilePath,
    historyFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const engineeringPlanManager = options.engineeringPlanManager ?? createEngineeringPlanManager({
    plansFilePath: options.plansFilePath,
    historyFilePath: options.engineeringPlanHistoryFilePath,
  });

  const productSpecManager = options.productSpecManager ?? createProductSpecManager({
    specsFilePath: options.specsFilePath,
    historyFilePath: options.specHistoryFilePath,
  });

  function appendCommerceEvent(input: {
    chargeIntentId: string;
    eventType: Parameters<CommerceHistoryStore['appendCommerceEvent']>[0]['eventType'];
    payload: Record<string, unknown>;
  }) {
    return historyStore.appendCommerceEvent({
      chargeIntentId: input.chargeIntentId,
      eventType: input.eventType,
      payloadHash: toCommercePayloadHash(input.payload),
      payload: JSON.parse(canonicalStringify(input.payload)) as Record<string, unknown>,
    });
  }

  function listChargeIntents(): ChargeIntent[] {
    return readStore(commerceFilePath).chargeIntents;
  }

  function getChargeIntent(chargeIntentId: string): ChargeIntent {
    const intent = readStore(commerceFilePath).chargeIntents.find((entry) => entry.chargeIntentId === chargeIntentId);
    if (!intent) {
      throw new Error(`COMMERCE_CHARGE_INTENT_NOT_FOUND: ${chargeIntentId}`);
    }

    return intent;
  }

  function upsertChargeIntent(intent: ChargeIntent): void {
    const current = readStore(commerceFilePath);
    const index = current.chargeIntents.findIndex((entry) => entry.chargeIntentId === intent.chargeIntentId);

    if (index < 0) {
      writeStore(commerceFilePath, {
        ...current,
        chargeIntents: [...current.chargeIntents, intent],
      });

      return;
    }

    const nextIntents = [...current.chargeIntents];
    nextIntents[index] = intent;

    writeStore(commerceFilePath, {
      ...current,
      chargeIntents: nextIntents,
    });
  }

  function deriveCommerceProjection(chargeIntentId: string): CommerceProjection {
    const intent = getChargeIntent(chargeIntentId);
    const store = readStore(commerceFilePath);

    return projectCommerce({
      chargeIntent: intent,
      manualPaymentReceipts: store.manualPaymentReceipts.filter((entry) => entry.chargeIntentId === chargeIntentId),
      history: historyStore.listCommerceEvents(chargeIntentId),
    });
  }

  function syncDerivedCommerceEvents(projection: CommerceProjection): void {
    appendCommerceEvent({
      chargeIntentId: projection.chargeIntentId,
      eventType: 'rail_binding_recorded',
      payload: {
        railBindingIds: projection.railBindingSummaries.map((entry) => entry.railBindingId),
      },
    });

    appendCommerceEvent({
      chargeIntentId: projection.chargeIntentId,
      eventType: 'rail_eligibility_evaluated',
      payload: {
        railEligibilityIds: projection.railEligibilitySummaries.map((entry) => entry.railEligibilityId),
      },
    });

    appendCommerceEvent({
      chargeIntentId: projection.chargeIntentId,
      eventType: 'payment_receipt_recorded',
      payload: {
        paymentReceiptIds: projection.paymentReceiptSummaries.map((entry) => entry.paymentReceiptId),
      },
    });

    appendCommerceEvent({
      chargeIntentId: projection.chargeIntentId,
      eventType: 'settlement_logged',
      payload: {
        settlementLogIds: projection.settlementLogSummaries.map((entry) => entry.settlementLogId),
        status: projection.status,
        outcome: projection.outcome,
      },
    });

    if (projection.status === 'failed') {
      appendCommerceEvent({
        chargeIntentId: projection.chargeIntentId,
        eventType: 'commerce_failed',
        payload: {
          chargeIntentId: projection.chargeIntentId,
          status: projection.status,
          outcome: projection.outcome,
        },
      });
    }
  }

  function createChargeIntent(create: ChargeIntentCreateInput): {
    chargeIntentId: string;
    buildEvidenceBundleId: string;
    runId: string;
    productSpecId: string;
  } {
    const upstream = toUpstreamContext({
      buildEvidenceBundleId: create.buildEvidenceBundleId,
      buildEvidenceManager,
      buildExecutionManager,
      packetManager,
      scaffoldManager,
      taskGraphManager,
      engineeringPlanManager,
      productSpecManager,
    });

    const intent = createChargeIntentRecord({
      create,
      upstream,
    });

    const existing = readStore(commerceFilePath).chargeIntents.find((entry) => entry.chargeIntentId === intent.chargeIntentId);
    if (!existing) {
      upsertChargeIntent(intent);
      appendCommerceEvent({
        chargeIntentId: intent.chargeIntentId,
        eventType: 'charge_intent_created',
        payload: {
          chargeIntentId: intent.chargeIntentId,
          buildEvidenceBundleId: intent.buildEvidenceBundleId,
          runId: intent.runId,
          productSpecId: intent.productSpecId,
        },
      });
    }

    const projection = deriveCommerceProjection(intent.chargeIntentId);
    syncDerivedCommerceEvents(projection);

    const finalized = deriveCommerceProjection(intent.chargeIntentId);
    upsertChargeIntent({
      ...intent,
      status: finalized.status,
      outcome: finalized.outcome,
    });

    return {
      chargeIntentId: intent.chargeIntentId,
      buildEvidenceBundleId: intent.buildEvidenceBundleId,
      runId: intent.runId,
      productSpecId: intent.productSpecId,
    };
  }

  function recordPaymentReceipt(input: PaymentReceiptRecordInput): PaymentReceipt {
    const projection = deriveCommerceProjection(input.chargeIntentId);
    const binding = projection.railBindingSummaries.find((entry) => entry.railBindingId === input.railBindingId);
    if (!binding) {
      throw new Error(`COMMERCE_RAIL_BINDING_NOT_FOUND: ${input.railBindingId}`);
    }

    const receipt = createManualPaymentReceipt(input);
    const store = readStore(commerceFilePath);
    if (!store.manualPaymentReceipts.some((entry) => entry.paymentReceiptId === receipt.paymentReceiptId)) {
      writeStore(commerceFilePath, {
        ...store,
        manualPaymentReceipts: [...store.manualPaymentReceipts, receipt],
      });

      appendCommerceEvent({
        chargeIntentId: input.chargeIntentId,
        eventType: 'payment_receipt_recorded',
        payload: {
          paymentReceiptId: receipt.paymentReceiptId,
          railBindingId: receipt.railBindingId,
          receiptClass: receipt.receiptClass,
          receiptReference: receipt.receiptReference,
        },
      });
    }

    const finalized = deriveCommerceProjection(input.chargeIntentId);
    syncDerivedCommerceEvents(finalized);

    const intent = getChargeIntent(input.chargeIntentId);
    upsertChargeIntent({
      ...intent,
      status: finalized.status,
      outcome: finalized.outcome,
    });

    return receipt;
  }

  function listCommerceProjections(): CommerceProjection[] {
    return listChargeIntents()
      .map((intent) => deriveCommerceProjection(intent.chargeIntentId))
      .sort((left, right) => left.chargeIntentId.localeCompare(right.chargeIntentId));
  }

  return {
    historyStore,
    appendCommerceEvent,
    createChargeIntent,
    getChargeIntent,
    listChargeIntents,
    deriveCommerceProjection,
    listCommerceProjections,
    recordPaymentReceipt,
  };
}

export type CommerceManager = ReturnType<typeof createCommerceManager>;
