import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import type { SynthesisReport } from './synthesis-types.ts';

const DEFAULT_SYNTHESIS_ARTIFACTS_ROOT = path.join('artifacts', 'synthesis');

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function renderMarkdown(report: SynthesisReport): string {
  const lines: string[] = [
    '# Cross-Investigation Synthesis Report',
    '',
    `- synthesisId: ${report.synthesisId}`,
    `- synthesisType: ${report.synthesisType}`,
    `- subjectKey: ${report.subjectKey}`,
    `- status: ${report.status}`,
    ''
  ];

  lines.push('## Linked Investigations');
  if (report.linkedInvestigations.length === 0) {
    lines.push('- none');
  } else {
    for (const row of report.linkedInvestigations) {
      lines.push(`- ${row.investigationRunId}`);
      lines.push(`  definition: ${row.investigationDefinitionId}`);
      lines.push(`  signalType: ${row.sourceSignalType}`);
      lines.push(`  status: ${row.status}`);
      lines.push(`  readiness: ${row.readinessState}`);
      lines.push(`  confidence: ${row.reportConfidenceBand}`);
      lines.push(`  findings: ${row.findings.join(', ') || 'none'}`);
    }
  }

  lines.push('', '## Why Linked');
  if (report.linkedReasons.length === 0) {
    lines.push('- none');
  } else {
    for (const reason of report.linkedReasons) {
      lines.push(`- ${reason.reason}`);
    }
  }

  lines.push('', '## Aggregate Findings');
  if (report.findings.length === 0) {
    lines.push('- none');
  } else {
    for (const finding of report.findings) {
      lines.push(`- ${finding.findingId}`);
      lines.push(`  title: ${finding.title}`);
      lines.push(`  confidenceBand: ${finding.confidenceBand}`);
      lines.push(`  supportingInvestigations: ${finding.supportingInvestigationIds.join(', ') || 'none'}`);
      lines.push(`  conflictingInvestigations: ${finding.conflictingInvestigationIds.join(', ') || 'none'}`);
      lines.push(`  supportingFindingIds: ${finding.supportingFindingIds.join(', ') || 'none'}`);
      lines.push(`  conflictingFindingIds: ${finding.conflictingFindingIds.join(', ') || 'none'}`);
      lines.push(`  strengths: ${finding.strengths.join(', ') || 'none'}`);
      lines.push(`  limitations: ${finding.limitations.join(', ') || 'none'}`);
    }
  }

  lines.push('', '## Confidence');
  lines.push(`- overallBand: ${report.confidence.overallBand}`);
  lines.push(`- supportingFactors: ${report.confidence.supportingFactors.join(', ') || 'none'}`);
  lines.push(`- weakeningFactors: ${report.confidence.weakeningFactors.join(', ') || 'none'}`);
  lines.push(`- unresolvedConflicts: ${report.confidence.unresolvedConflicts.join(', ') || 'none'}`);

  lines.push('', '## Reinforcement And Conflicts');
  lines.push(`- reinforcingInvestigationIds: ${report.reinforcingInvestigationIds.join(', ') || 'none'}`);
  lines.push(`- conflictingInvestigationIds: ${report.conflictingInvestigationIds.join(', ') || 'none'}`);

  if (report.conflicts.length === 0) {
    lines.push('- conflicts: none');
  } else {
    lines.push('- conflicts:');
    for (const conflict of report.conflicts) {
      lines.push(`  - ${conflict.conflictId}: ${conflict.summary}`);
      lines.push(`    investigations: ${conflict.conflictingInvestigationIds.join(', ') || 'none'}`);
      lines.push(`    findings: ${conflict.conflictingFindingIds.join(', ') || 'none'}`);
    }
  }

  lines.push('', '## Unresolved Limitations');
  if (report.unresolvedLimitations.length === 0) {
    lines.push('- none');
  } else {
    for (const limitation of report.unresolvedLimitations) {
      lines.push(`- ${limitation}`);
    }
  }

  lines.push('', '## Conclusion');
  lines.push(report.conclusion);

  return `${lines.join('\n')}\n`;
}

export function writeSynthesisReport(input: {
  report: SynthesisReport;
  artifactsRoot?: string;
}): {
  jsonPath: string;
  markdownPath: string;
} {
  const artifactsRoot = path.resolve(input.artifactsRoot ?? DEFAULT_SYNTHESIS_ARTIFACTS_ROOT);
  const synthesisRoot = path.join(artifactsRoot, input.report.synthesisId);
  ensureDir(synthesisRoot);

  const jsonPath = path.join(synthesisRoot, 'synthesis-report.json');
  const markdownPath = path.join(synthesisRoot, 'synthesis-report.md');

  fs.writeFileSync(jsonPath, `${canonicalStringify(input.report)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, renderMarkdown(input.report), 'utf8');

  return {
    jsonPath,
    markdownPath
  };
}
