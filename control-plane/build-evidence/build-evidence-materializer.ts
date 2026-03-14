import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createBuildEvidenceManager,
  type BuildEvidenceManager,
} from './build-evidence-manager.ts';
import type { BuildEvidenceMaterializationSummary } from './build-evidence-types.ts';

const DEFAULT_BUILD_EVIDENCE_ARTIFACTS_ROOT = path.join('artifacts', 'build-evidence');

function resolveMaterializationPaths(input: {
  buildEvidenceBundleId: string;
  artifactsRoot?: string;
}) {
  const normalizedId = input.buildEvidenceBundleId.trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalizedId.length === 0 || normalizedId.includes('/') || normalizedId.includes('..')) {
    throw new Error(`INVALID_BUILD_EVIDENCE_BUNDLE_ID: ${input.buildEvidenceBundleId}`);
  }

  const root = path.resolve(input.artifactsRoot ?? DEFAULT_BUILD_EVIDENCE_ARTIFACTS_ROOT);
  const dirPath = path.join(root, normalizedId);

  return {
    dirPath,
    statusPath: path.join(dirPath, 'build-evidence-status.json'),
    artifactVerificationPath: path.join(dirPath, 'build-evidence-artifact-verification.json'),
    promptAttestationPath: path.join(dirPath, 'build-evidence-prompt-attestation.json'),
    executionPlanAttestationPath: path.join(dirPath, 'build-evidence-execution-plan-attestation.json'),
    historyPath: path.join(dirPath, 'build-evidence-history.json'),
    outcomePath: path.join(dirPath, 'build-evidence-outcome.json'),
    reportJsonPath: path.join(dirPath, 'build-evidence-report.json'),
    reportMarkdownPath: path.join(dirPath, 'build-evidence-report.md'),
  };
}

function toMarkdownReport(input: {
  buildEvidenceBundleId: string;
  runId: string;
  packetId: string;
  bundleId: string;
  governanceValidation: string;
  verificationStatus: string;
  outcome: string;
  artifactVerifications: number;
  historyEvents: number;
}): string {
  const lines = [
    '# Build Evidence Report',
    '',
    `Build Evidence Bundle: ${input.buildEvidenceBundleId}`,
    `Run: ${input.runId}`,
    `Packet: ${input.packetId}`,
    `Bundle: ${input.bundleId}`,
    `Governance Validation: ${input.governanceValidation}`,
    `Verification Status: ${input.verificationStatus}`,
    `Outcome: ${input.outcome}`,
    '',
    '## Summary',
    `- artifactVerifications: ${String(input.artifactVerifications)}`,
    `- historyEvents: ${String(input.historyEvents)}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify(input),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function createBuildEvidenceMaterializer(options: {
  manager?: BuildEvidenceManager;
  artifactsRoot?: string;
  bundlesFilePath?: string;
  historyFilePath?: string;
  runsFilePath?: string;
  runHistoryFilePath?: string;
  packetsFilePath?: string;
  packetHistoryFilePath?: string;
  bundlesRuntimeFilePath?: string;
  bundleHistoryFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
} = {}) {
  const manager = options.manager ?? createBuildEvidenceManager({
    bundlesFilePath: options.bundlesFilePath,
    historyFilePath: options.historyFilePath,
    runsFilePath: options.runsFilePath,
    runHistoryFilePath: options.runHistoryFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesRuntimeFilePath: options.bundlesRuntimeFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function materializeBuildEvidenceBundle(buildEvidenceBundleId: string): BuildEvidenceMaterializationSummary {
    const projection = manager.verifyBuildEvidenceBundle(buildEvidenceBundleId);
    const paths = resolveMaterializationPaths({
      buildEvidenceBundleId,
      artifactsRoot: options.artifactsRoot,
    });

    fs.mkdirSync(paths.dirPath, { recursive: true });

    const statusPayload = {
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      runId: projection.runId,
      packetId: projection.packetId,
      bundleId: projection.bundleId,
      governanceValidation: projection.governanceValidation,
      verificationStatus: projection.verificationStatus,
    };

    const outcomePayload = {
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      runId: projection.runId,
      outcome: projection.outcome,
    };

    const reportPayload = {
      ...statusPayload,
      outcome: projection.outcome,
      promptAttestation: projection.promptAttestationSummary,
      executionPlanAttestation: projection.executionPlanAttestationSummary,
      artifactVerificationSummaries: projection.artifactVerificationSummaries,
      evidenceHistory: projection.evidenceHistory,
    };

    fs.writeFileSync(paths.statusPath, `${canonicalStringify(statusPayload)}\n`, 'utf8');
    fs.writeFileSync(paths.artifactVerificationPath, `${canonicalStringify(projection.artifactVerificationSummaries)}\n`, 'utf8');
    fs.writeFileSync(paths.promptAttestationPath, `${canonicalStringify(projection.promptAttestationSummary)}\n`, 'utf8');
    fs.writeFileSync(paths.executionPlanAttestationPath, `${canonicalStringify(projection.executionPlanAttestationSummary)}\n`, 'utf8');
    fs.writeFileSync(paths.historyPath, `${canonicalStringify(projection.evidenceHistory)}\n`, 'utf8');
    fs.writeFileSync(paths.outcomePath, `${canonicalStringify(outcomePayload)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(reportPayload)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      runId: projection.runId,
      packetId: projection.packetId,
      bundleId: projection.bundleId,
      governanceValidation: projection.governanceValidation,
      verificationStatus: projection.verificationStatus,
      outcome: projection.outcome,
      artifactVerifications: projection.artifactVerificationSummaries.length,
      historyEvents: projection.evidenceHistory.length,
    }), 'utf8');

    manager.appendBuildEvidenceEvent({
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      runId: projection.runId,
      eventType: 'build_evidence_materialized',
      payload: {
        buildEvidenceBundleId: projection.buildEvidenceBundleId,
        runId: projection.runId,
        dirPath: paths.dirPath,
      },
    });

    return {
      buildEvidenceBundleId: projection.buildEvidenceBundleId,
      dirPath: paths.dirPath,
      statusPath: paths.statusPath,
      artifactVerificationPath: paths.artifactVerificationPath,
      promptAttestationPath: paths.promptAttestationPath,
      executionPlanAttestationPath: paths.executionPlanAttestationPath,
      historyPath: paths.historyPath,
      outcomePath: paths.outcomePath,
      reportJsonPath: paths.reportJsonPath,
      reportMarkdownPath: paths.reportMarkdownPath,
    };
  }

  return {
    materializeBuildEvidenceBundle,
  };
}

export type BuildEvidenceMaterializer = ReturnType<typeof createBuildEvidenceMaterializer>;
