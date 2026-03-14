import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createCommerceManager,
  type CommerceManager,
} from './commerce-manager.ts';
import type { CommerceMaterializationSummary } from './charge-intent-types.ts';

const DEFAULT_COMMERCE_ARTIFACTS_ROOT = path.join('artifacts', 'commerce');

function resolveMaterializationPaths(input: {
  chargeIntentId: string;
  artifactsRoot?: string;
}) {
  const normalizedId = input.chargeIntentId.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalizedId.length === 0 || normalizedId.includes('/') || normalizedId.includes('..')) {
    throw new Error(`INVALID_CHARGE_INTENT_ID: ${input.chargeIntentId}`);
  }

  const root = path.resolve(input.artifactsRoot ?? DEFAULT_COMMERCE_ARTIFACTS_ROOT);
  const dirPath = path.join(root, normalizedId);

  return {
    dirPath,
    statusPath: path.join(dirPath, 'commerce-status.json'),
    railBindingsPath: path.join(dirPath, 'commerce-rail-bindings.json'),
    railEligibilityPath: path.join(dirPath, 'commerce-rail-eligibility.json'),
    paymentReceiptsPath: path.join(dirPath, 'commerce-payment-receipts.json'),
    settlementLogPath: path.join(dirPath, 'commerce-settlement-log.json'),
    historyPath: path.join(dirPath, 'commerce-history.json'),
    outcomePath: path.join(dirPath, 'commerce-outcome.json'),
    reportJsonPath: path.join(dirPath, 'commerce-report.json'),
    reportMarkdownPath: path.join(dirPath, 'commerce-report.md'),
  };
}

function toMarkdownReport(input: {
  chargeIntentId: string;
  buildEvidenceBundleId: string;
  runId: string;
  productSpecId: string;
  status: string;
  outcome: string;
  railBindings: number;
  railEligibility: number;
  paymentReceipts: number;
  settlementLogs: number;
  historyEvents: number;
}): string {
  const lines = [
    '# Commerce Report',
    '',
    `Charge Intent: ${input.chargeIntentId}`,
    `Build Evidence Bundle: ${input.buildEvidenceBundleId}`,
    `Run: ${input.runId}`,
    `Product Spec: ${input.productSpecId}`,
    `Status: ${input.status}`,
    `Outcome: ${input.outcome}`,
    '',
    '## Summary',
    `- railBindings: ${String(input.railBindings)}`,
    `- railEligibility: ${String(input.railEligibility)}`,
    `- paymentReceipts: ${String(input.paymentReceipts)}`,
    `- settlementLogs: ${String(input.settlementLogs)}`,
    `- historyEvents: ${String(input.historyEvents)}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify(input),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function createCommerceMaterializer(options: {
  manager?: CommerceManager;
  artifactsRoot?: string;
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

  function materializeCommerce(chargeIntentId: string): CommerceMaterializationSummary {
    const projection = manager.deriveCommerceProjection(chargeIntentId);
    const paths = resolveMaterializationPaths({
      chargeIntentId,
      artifactsRoot: options.artifactsRoot,
    });

    fs.mkdirSync(paths.dirPath, { recursive: true });

    const statusPayload = {
      chargeIntentId: projection.chargeIntentId,
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      runId: projection.runId,
      status: projection.status,
    };

    const outcomePayload = {
      chargeIntentId: projection.chargeIntentId,
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      outcome: projection.outcome,
    };

    const reportPayload = {
      ...statusPayload,
      productSpecId: projection.productSpecId,
      outcome: projection.outcome,
      railBindingSummaries: projection.railBindingSummaries,
      railEligibilitySummaries: projection.railEligibilitySummaries,
      paymentReceiptSummaries: projection.paymentReceiptSummaries,
      settlementLogSummaries: projection.settlementLogSummaries,
      commerceHistory: projection.commerceHistory,
    };

    fs.writeFileSync(paths.statusPath, `${canonicalStringify(statusPayload)}\n`, 'utf8');
    fs.writeFileSync(paths.railBindingsPath, `${canonicalStringify(projection.railBindingSummaries)}\n`, 'utf8');
    fs.writeFileSync(paths.railEligibilityPath, `${canonicalStringify(projection.railEligibilitySummaries)}\n`, 'utf8');
    fs.writeFileSync(paths.paymentReceiptsPath, `${canonicalStringify(projection.paymentReceiptSummaries)}\n`, 'utf8');
    fs.writeFileSync(paths.settlementLogPath, `${canonicalStringify(projection.settlementLogSummaries)}\n`, 'utf8');
    fs.writeFileSync(paths.historyPath, `${canonicalStringify(projection.commerceHistory)}\n`, 'utf8');
    fs.writeFileSync(paths.outcomePath, `${canonicalStringify(outcomePayload)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(reportPayload)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      chargeIntentId: projection.chargeIntentId,
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      runId: projection.runId,
      productSpecId: projection.productSpecId,
      status: projection.status,
      outcome: projection.outcome,
      railBindings: projection.railBindingSummaries.length,
      railEligibility: projection.railEligibilitySummaries.length,
      paymentReceipts: projection.paymentReceiptSummaries.length,
      settlementLogs: projection.settlementLogSummaries.length,
      historyEvents: projection.commerceHistory.length,
    }), 'utf8');

    manager.appendCommerceEvent({
      chargeIntentId: projection.chargeIntentId,
      eventType: 'commerce_materialized',
      payload: {
        chargeIntentId: projection.chargeIntentId,
        buildEvidenceBundleId: projection.buildEvidenceBundleId,
      },
    });

    return {
      chargeIntentId: projection.chargeIntentId,
      dirPath: paths.dirPath,
      statusPath: paths.statusPath,
      railBindingsPath: paths.railBindingsPath,
      railEligibilityPath: paths.railEligibilityPath,
      paymentReceiptsPath: paths.paymentReceiptsPath,
      settlementLogPath: paths.settlementLogPath,
      historyPath: paths.historyPath,
      outcomePath: paths.outcomePath,
      reportJsonPath: paths.reportJsonPath,
      reportMarkdownPath: paths.reportMarkdownPath,
    };
  }

  return {
    materializeCommerce,
  };
}

export type CommerceMaterializer = ReturnType<typeof createCommerceMaterializer>;
