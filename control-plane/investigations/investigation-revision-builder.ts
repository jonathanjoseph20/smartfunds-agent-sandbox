import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import type { InvestigationCompletionStatus } from './completion-types.ts';
import type { ConfidenceSummary, InvestigationFinding } from './evidence-types.ts';
import type {
  ConfidenceSnapshot,
  FindingSnapshot,
  InvestigationContinuitySummary,
  InvestigationDelta,
  InvestigationRevisionRecord,
} from './revision-types.ts';
import { toFindingSnapshot } from './revision-types.ts';

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function writeCanonicalJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${canonicalStringify(value)}\n`, 'utf8');
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function revisionIdFromNumber(revisionNumber: number): string {
  return `revision-${String(revisionNumber).padStart(4, '0')}`;
}

function buildConfidenceSnapshot(input: {
  investigationRunId: string;
  reportConfidence: ConfidenceSummary;
  findings: InvestigationFinding[];
}): ConfidenceSnapshot {
  return {
    investigationRunId: input.investigationRunId,
    reportConfidenceBand: input.reportConfidence.confidenceBand,
    reportConfidenceScore: input.reportConfidence.confidenceScore,
    reportStrengths: uniqueSorted(input.reportConfidence.strengths),
    reportLimitations: uniqueSorted(input.reportConfidence.limitations),
    findings: [...input.findings]
      .sort((left, right) => left.findingId.localeCompare(right.findingId))
      .map((finding) => ({
        findingId: finding.findingId,
        confidenceBand: finding.confidenceBand,
        confidenceScore: finding.confidenceScore
      }))
  };
}

function buildFindingsSnapshot(findings: InvestigationFinding[]): FindingSnapshot[] {
  return findings
    .map((finding) => toFindingSnapshot(finding))
    .sort((left, right) => left.findingId.localeCompare(right.findingId));
}

function revisionSummaryMarkdown(input: {
  record: InvestigationRevisionRecord;
  continuitySummary?: InvestigationContinuitySummary;
}): string {
  const lines = [
    '# Investigation Revision Summary',
    '',
    `- investigationRunId: ${input.record.investigationRunId}`,
    `- revisionId: ${input.record.revisionId}`,
    `- revisionNumber: ${String(input.record.revisionNumber)}`,
    `- reportPath: ${input.record.reportPath}`,
    `- findingsSnapshotPath: ${input.record.findingsSnapshotPath}`,
    `- confidenceSnapshotPath: ${input.record.confidenceSnapshotPath}`,
    `- deltaPath: ${input.record.deltaPath ?? 'pending'}`,
    `- continuitySummaryPath: ${input.record.continuitySummaryPath ?? 'pending'}`,
    `- completionStatusPath: ${input.record.completionStatusPath ?? 'pending'}`,
  ];

  if (input.record.slotReference) {
    lines.push(`- slotReference: ${input.record.slotReference}`);
  }

  if (input.continuitySummary) {
    lines.push(
      '',
      '## Continuity',
      `- continuityState: ${input.continuitySummary.continuityState}`,
      `- confidenceTrend: ${input.continuitySummary.confidenceTrend}`,
      `- revisionCount: ${String(input.continuitySummary.revisionCount)}`
    );
  }

  return `${lines.join('\n')}\n`;
}

export function createInvestigationRevisionBuilder(options: {
  artifactsRoot?: string;
} = {}) {
  const artifactsRoot = path.resolve(options.artifactsRoot ?? path.join('artifacts', 'investigations'));

  function revisionsRoot(investigationRunId: string): string {
    return path.join(artifactsRoot, investigationRunId, 'revisions');
  }

  function listRevisionDirectories(investigationRunId: string): string[] {
    const root = revisionsRoot(investigationRunId);
    if (!fs.existsSync(root)) {
      return [];
    }
    return fs.readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => /^revision-\d{4}$/.test(name))
      .sort((left, right) => left.localeCompare(right));
  }

  function createRevisionSnapshot(input: {
    investigationRunId: string;
    slotReference?: string;
    reportPath: string;
    findings: InvestigationFinding[];
    reportConfidence: ConfidenceSummary;
  }): {
    record: InvestigationRevisionRecord;
    revisionDir: string;
    findingsSnapshot: FindingSnapshot[];
    confidenceSnapshot: ConfidenceSnapshot;
  } {
    const revisionNumber = listRevisionDirectories(input.investigationRunId).length + 1;
    const revisionId = revisionIdFromNumber(revisionNumber);
    const revisionDir = path.join(revisionsRoot(input.investigationRunId), revisionId);

    if (fs.existsSync(revisionDir)) {
      throw new Error(`INVESTIGATION_REVISION_ALREADY_EXISTS: ${revisionDir}`);
    }
    ensureDir(revisionDir);

    const findingsSnapshot = buildFindingsSnapshot(input.findings);
    const confidenceSnapshot = buildConfidenceSnapshot({
      investigationRunId: input.investigationRunId,
      reportConfidence: input.reportConfidence,
      findings: input.findings
    });

    const findingsSnapshotPath = path.join(revisionDir, 'findings-snapshot.json');
    const confidenceSnapshotPath = path.join(revisionDir, 'confidence-snapshot.json');

    writeCanonicalJson(findingsSnapshotPath, findingsSnapshot);
    writeCanonicalJson(confidenceSnapshotPath, confidenceSnapshot);

    const record: InvestigationRevisionRecord = {
      revisionId,
      investigationRunId: input.investigationRunId,
      revisionNumber,
      ...(input.slotReference ? { slotReference: input.slotReference } : {}),
      reportPath: input.reportPath,
      findingsSnapshotPath,
      confidenceSnapshotPath
    };

    writeCanonicalJson(path.join(revisionDir, 'revision-summary.json'), record);
    fs.writeFileSync(path.join(revisionDir, 'revision-summary.md'), revisionSummaryMarkdown({ record }), 'utf8');

    return {
      record,
      revisionDir,
      findingsSnapshot,
      confidenceSnapshot
    };
  }

  function persistDelta(input: { revisionDir: string; delta: InvestigationDelta }): string {
    const filePath = path.join(input.revisionDir, 'delta.json');
    writeCanonicalJson(filePath, input.delta);
    return filePath;
  }

  function persistContinuitySummary(input: {
    revisionDir: string;
    summary: InvestigationContinuitySummary;
  }): string {
    const filePath = path.join(input.revisionDir, 'continuity-summary.json');
    writeCanonicalJson(filePath, input.summary);
    return filePath;
  }

  function persistCompletionStatus(input: {
    revisionDir: string;
    status: InvestigationCompletionStatus;
  }): string {
    const filePath = path.join(input.revisionDir, 'completion-status.json');
    writeCanonicalJson(filePath, input.status);
    return filePath;
  }

  function finalizeRevisionSummary(input: {
    revisionDir: string;
    record: InvestigationRevisionRecord;
    continuitySummary: InvestigationContinuitySummary;
  }): void {
    writeCanonicalJson(path.join(input.revisionDir, 'revision-summary.json'), input.record);
    fs.writeFileSync(
      path.join(input.revisionDir, 'revision-summary.md'),
      revisionSummaryMarkdown({
        record: input.record,
        continuitySummary: input.continuitySummary
      }),
      'utf8'
    );
  }

  return {
    createRevisionSnapshot,
    persistDelta,
    persistContinuitySummary,
    persistCompletionStatus,
    finalizeRevisionSummary
  };
}

export type InvestigationRevisionBuilder = ReturnType<typeof createInvestigationRevisionBuilder>;
