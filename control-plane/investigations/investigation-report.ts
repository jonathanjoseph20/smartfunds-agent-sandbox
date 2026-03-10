import fs from 'node:fs';
import path from 'node:path';

import { canonicalStringify } from '../finance/determinism.ts';

import type {
  InvestigationDefinition,
  InvestigationEventRecord,
  InvestigationRecord
} from './investigation-types.ts';

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
}

function summarizeConclusion(record: InvestigationRecord, signalMetadata: Record<string, unknown>): {
  summary: string;
  severity: 'low' | 'medium' | 'high';
  nextSteps: string[];
} {
  const protocol = typeof signalMetadata.protocol === 'string' ? signalMetadata.protocol : 'unknown';
  if (record.sourceSignalType === 'liquidity_drain') {
    const value = Number(signalMetadata.liquidityDropPercent ?? 0);
    return {
      summary: `Liquidity contraction detected for ${protocol} with a measured decline of ${String(value)}%.`,
      severity: value >= 20 ? 'high' : 'medium',
      nextSteps: [
        `Review liquidity venues for ${protocol}.`,
        `Re-run scheduled liquidity scan for slot ${record.slot}.`
      ]
    };
  }
  if (record.sourceSignalType === 'yield_anomaly') {
    const value = Number(signalMetadata.yieldChangePercent ?? 0);
    return {
      summary: `Yield movement for ${protocol} deviated by ${String(value)}%.`,
      severity: Math.abs(value) >= 10 ? 'high' : 'medium',
      nextSteps: [
        `Compare current yield sources for ${protocol}.`,
        `Review recent incentive or utilization changes for ${protocol}.`
      ]
    };
  }
  if (record.sourceSignalType === 'governance_proposal') {
    const proposalId = typeof signalMetadata.proposalId === 'string' ? signalMetadata.proposalId : 'unknown';
    return {
      summary: `Governance proposal ${proposalId} for ${protocol} requires operator review.`,
      severity: 'medium',
      nextSteps: [
        `Inspect proposal ${proposalId} vote trajectory.`,
        `Compare proposal scope against current protocol dependencies.`
      ]
    };
  }

  const riskLevel = typeof signalMetadata.riskLevel === 'string' ? signalMetadata.riskLevel : 'high';
  return {
    summary: `Protocol risk signal for ${protocol} is classified as ${riskLevel}.`,
    severity: riskLevel === 'high' ? 'high' : 'medium',
    nextSteps: [
      `Inspect recent governance and operational changes for ${protocol}.`,
      `Review downstream exposure linked to ${protocol}.`
    ]
  };
}

function phaseSummary(
  definition: InvestigationDefinition,
  history: InvestigationEventRecord[],
  artifactPaths: string[]
): Array<{ phaseId: string; kind: string; status: string; findings: string[]; artifacts: string[] }> {
  return definition.phases.map((phase) => {
    const started = history.some((event) => event.eventType === 'PHASE_STARTED' && event.phaseId === phase.phaseId);
    const completedEvent = history.find((event) => event.eventType === 'PHASE_COMPLETED' && event.phaseId === phase.phaseId);
    const artifacts = artifactPaths
      .filter((artifactPath) => artifactPath.includes(`/${phase.phaseId}-`) || artifactPath.endsWith(`/${phase.phaseId}.json`))
      .sort((left, right) => left.localeCompare(right));

    return {
      phaseId: phase.phaseId,
      kind: phase.kind,
      status: completedEvent ? 'completed' : (started ? 'running' : 'pending'),
      findings: completedEvent && completedEvent.eventType === 'PHASE_COMPLETED' ? completedEvent.findings : [],
      artifacts
    };
  });
}

function markdownForReport(input: {
  record: InvestigationRecord;
  definition: InvestigationDefinition;
  phaseSummaryRows: Array<{ phaseId: string; kind: string; status: string; findings: string[]; artifacts: string[] }>;
  conclusion: { summary: string; severity: string; nextSteps: string[] };
}): string {
  const lines = [
    '# Investigation Report',
    '',
    `- investigationRunId: ${input.record.investigationRunId}`,
    `- investigationDefinitionId: ${input.record.investigationDefinitionId}`,
    `- sourceSignalReference: ${input.record.sourceSignalReference}`,
    `- sourceSignalType: ${input.record.sourceSignalType}`,
    `- sourceTriggerId: ${input.record.sourceTriggerId ?? 'n/a'}`,
    `- sourceTriggerReference: ${input.record.sourceTriggerReference ?? 'n/a'}`,
    `- slot: ${input.record.slot}`,
    `- status: ${input.record.status}`,
    '',
    '## Phases'
  ];

  input.phaseSummaryRows.forEach((phase, index) => {
    lines.push(`${String(index + 1)}. ${phase.phaseId} (${phase.kind}) - ${phase.status}`);
    phase.findings.forEach((finding) => {
      lines.push(`finding: ${finding}`);
    });
    phase.artifacts.forEach((artifact) => {
      lines.push(`artifact: ${artifact}`);
    });
  });

  lines.push('', '## Artifacts');
  input.record.artifactPaths.forEach((artifactPath) => {
    lines.push(`- ${artifactPath}`);
  });

  lines.push('', '## Findings');
  input.record.findings.forEach((finding) => {
    lines.push(`- ${finding}`);
  });

  lines.push('', '## Conclusion');
  lines.push(input.conclusion.summary);
  lines.push(`Severity: ${input.conclusion.severity}`);

  lines.push('', '## Recommended Next Steps');
  input.conclusion.nextSteps.forEach((step) => {
    lines.push(`- ${step}`);
  });

  return `${lines.join('\n')}\n`;
}

export function writeInvestigationReport(input: {
  artifactsRoot: string;
  record: InvestigationRecord;
  definition: InvestigationDefinition;
  history: InvestigationEventRecord[];
}): {
  jsonPath: string;
  markdownPath: string;
  report: Record<string, unknown>;
} {
  const runRoot = path.join(input.artifactsRoot, input.record.investigationRunId);
  ensureDir(runRoot);

  const gatheredArtifactPath = input.record.artifactPaths.find((artifactPath) => artifactPath.endsWith('/gather-evidence.json'));
  const gathered = gatheredArtifactPath ? readJson(gatheredArtifactPath) as Record<string, unknown> : {};
  const signalMetadata = typeof gathered.signalMetadata === 'object' && gathered.signalMetadata !== null
    ? gathered.signalMetadata as Record<string, unknown>
    : {};

  const conclusion = summarizeConclusion(input.record, signalMetadata);
  const phaseSummaryRows = phaseSummary(input.definition, input.history, input.record.artifactPaths);
  const report = {
    investigationRunId: input.record.investigationRunId,
    investigationDefinitionId: input.record.investigationDefinitionId,
    source: {
      signalReference: input.record.sourceSignalReference,
      signalType: input.record.sourceSignalType,
      ...(input.record.sourceTriggerId ? { triggerId: input.record.sourceTriggerId } : {}),
      ...(input.record.sourceTriggerReference ? { triggerReference: input.record.sourceTriggerReference } : {}),
      slot: input.record.slot
    },
    status: input.record.status,
    phaseSummary: phaseSummaryRows,
    artifactPaths: input.record.artifactPaths,
    findings: input.record.findings,
    conclusion: {
      summary: conclusion.summary,
      severity: conclusion.severity
    },
    recommendedNextSteps: conclusion.nextSteps
  };

  const jsonPath = path.join(runRoot, 'investigation-report.json');
  const markdownPath = path.join(runRoot, 'investigation-report.md');

  fs.writeFileSync(jsonPath, `${canonicalStringify(report)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, markdownForReport({
    record: input.record,
    definition: input.definition,
    phaseSummaryRows,
    conclusion
  }), 'utf8');

  return {
    jsonPath,
    markdownPath,
    report
  };
}
