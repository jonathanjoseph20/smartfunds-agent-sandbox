import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createProductFactoryReleaseManager,
  type ProductFactoryReleaseManager,
} from './product-factory-release-manager.ts';
import type { ProductFactoryReleaseMaterializationSummary } from './product-factory-release-acceptance-types.ts';

const DEFAULT_PRODUCT_FACTORY_RELEASE_ARTIFACTS_ROOT = path.join('artifacts', 'product-factory-release');

function resolveMaterializationPaths(input: {
  productFactoryReleaseAcceptanceRecordId: string;
  artifactsRoot?: string;
}) {
  const normalizedId = input.productFactoryReleaseAcceptanceRecordId.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalizedId.length === 0 || normalizedId.includes('/') || normalizedId.includes('..')) {
    throw new Error(`INVALID_PRODUCT_FACTORY_RELEASE_ID: ${input.productFactoryReleaseAcceptanceRecordId}`);
  }

  const root = path.resolve(input.artifactsRoot ?? DEFAULT_PRODUCT_FACTORY_RELEASE_ARTIFACTS_ROOT);
  const dirPath = path.join(root, normalizedId);

  return {
    dirPath,
    statusPath: path.join(dirPath, 'product-factory-release-status.json'),
    lifecycleAcceptancePath: path.join(dirPath, 'product-factory-lifecycle-acceptance.json'),
    replayValidationPath: path.join(dirPath, 'product-factory-replay-validation.json'),
    docsCompletenessPath: path.join(dirPath, 'product-factory-docs-completeness.json'),
    releaseHardeningPath: path.join(dirPath, 'product-factory-release-hardening.json'),
    historyPath: path.join(dirPath, 'product-factory-release-history.json'),
    outcomePath: path.join(dirPath, 'product-factory-release-outcome.json'),
    reportJsonPath: path.join(dirPath, 'product-factory-release-report.json'),
    reportMarkdownPath: path.join(dirPath, 'product-factory-release-report.md'),
  };
}

function toMarkdownReport(input: {
  productFactoryReleaseAcceptanceRecordId: string;
  releaseTrack: string;
  status: string;
  outcome: string;
  lifecycleAcceptanceClass: string;
  replayValidationClass: string;
  docsCompletenessClass: string;
  releaseHardeningClass: string;
  coveredLayerCount: number;
  historyEventCount: number;
}): string {
  const lines = [
    '# Product Factory Release Acceptance Report',
    '',
    `Release Acceptance Record: ${input.productFactoryReleaseAcceptanceRecordId}`,
    `Release Track: ${input.releaseTrack}`,
    `Status: ${input.status}`,
    `Outcome: ${input.outcome}`,
    `Lifecycle Acceptance: ${input.lifecycleAcceptanceClass}`,
    `Replay Validation: ${input.replayValidationClass}`,
    `Docs Completeness: ${input.docsCompletenessClass}`,
    `Release Hardening: ${input.releaseHardeningClass}`,
    '',
    '## Summary',
    `- coveredLayerCount: ${String(input.coveredLayerCount)}`,
    `- historyEventCount: ${String(input.historyEventCount)}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify(input),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function createProductFactoryReleaseMaterializer(options: {
  manager?: ProductFactoryReleaseManager;
  artifactsRoot?: string;
  recordsFilePath?: string;
  historyFilePath?: string;
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

  function materializeRelease(
    productFactoryReleaseAcceptanceRecordId: string,
  ): ProductFactoryReleaseMaterializationSummary {
    const projection = manager.deriveReleaseProjection(productFactoryReleaseAcceptanceRecordId);
    const paths = resolveMaterializationPaths({
      productFactoryReleaseAcceptanceRecordId,
      artifactsRoot: options.artifactsRoot,
    });

    fs.mkdirSync(paths.dirPath, { recursive: true });

    const statusPayload = {
      productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
      releaseTrack: projection.releaseTrack,
      status: projection.status,
    };

    const outcomePayload = {
      productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
      releaseTrack: projection.releaseTrack,
      outcome: projection.outcome,
    };

    const reportPayload = {
      ...statusPayload,
      outcome: projection.outcome,
      coveredLayerSummaries: projection.coveredLayerSummaries,
      lifecycleAcceptanceSummary: projection.lifecycleAcceptanceSummary,
      replayValidationSummary: projection.replayValidationSummary,
      docsCompletenessSummary: projection.docsCompletenessSummary,
      releaseHardeningSummary: projection.releaseHardeningSummary,
      releaseHistory: projection.releaseHistory,
    };

    fs.writeFileSync(paths.statusPath, `${canonicalStringify(statusPayload)}\n`, 'utf8');
    fs.writeFileSync(paths.lifecycleAcceptancePath, `${canonicalStringify(projection.lifecycleAcceptanceSummary)}\n`, 'utf8');
    fs.writeFileSync(paths.replayValidationPath, `${canonicalStringify(projection.replayValidationSummary)}\n`, 'utf8');
    fs.writeFileSync(paths.docsCompletenessPath, `${canonicalStringify(projection.docsCompletenessSummary)}\n`, 'utf8');
    fs.writeFileSync(paths.releaseHardeningPath, `${canonicalStringify(projection.releaseHardeningSummary)}\n`, 'utf8');
    fs.writeFileSync(paths.historyPath, `${canonicalStringify(projection.releaseHistory)}\n`, 'utf8');
    fs.writeFileSync(paths.outcomePath, `${canonicalStringify(outcomePayload)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(reportPayload)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
      releaseTrack: projection.releaseTrack,
      status: projection.status,
      outcome: projection.outcome,
      lifecycleAcceptanceClass: projection.lifecycleAcceptanceSummary.acceptanceClass,
      replayValidationClass: projection.replayValidationSummary.validationClass,
      docsCompletenessClass: projection.docsCompletenessSummary.completenessClass,
      releaseHardeningClass: projection.releaseHardeningSummary.hardeningClass,
      coveredLayerCount: projection.coveredLayerSummaries.length,
      historyEventCount: projection.releaseHistory.length,
    }), 'utf8');

    manager.appendReleaseEvent({
      productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
      releaseTrack: projection.releaseTrack,
      eventType: 'product_factory_release_materialized',
      payload: {
        productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
        releaseTrack: projection.releaseTrack,
        dirPath: paths.dirPath,
      },
    });

    return {
      productFactoryReleaseAcceptanceRecordId: projection.productFactoryReleaseAcceptanceRecordId,
      dirPath: paths.dirPath,
      statusPath: paths.statusPath,
      lifecycleAcceptancePath: paths.lifecycleAcceptancePath,
      replayValidationPath: paths.replayValidationPath,
      docsCompletenessPath: paths.docsCompletenessPath,
      releaseHardeningPath: paths.releaseHardeningPath,
      historyPath: paths.historyPath,
      outcomePath: paths.outcomePath,
      reportJsonPath: paths.reportJsonPath,
      reportMarkdownPath: paths.reportMarkdownPath,
    };
  }

  return {
    materializeRelease,
  };
}

export type ProductFactoryReleaseMaterializer = ReturnType<typeof createProductFactoryReleaseMaterializer>;
