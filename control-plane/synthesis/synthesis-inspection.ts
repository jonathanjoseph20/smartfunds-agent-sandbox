import fs from 'node:fs';

import { createSynthesisMaterializer, type SynthesisMaterializer } from './synthesis-materializer.ts';
import { createSynthesisProjection, type SynthesisProjectionEngine } from './synthesis-projection.ts';
import { resolveSynthesisArtifactPaths } from './synthesis-runtime-paths.ts';
import type { SynthesisStatus } from './synthesis-status.ts';

function comparePath(left: string, right: string): number {
  return left.localeCompare(right);
}

type LegacySynthesisReport = {
  synthesisId: string;
  synthesisType: string;
  subjectKey: string;
  status: string;
  linkedInvestigations: Array<Record<string, unknown>>;
  linkedReasons: Array<Record<string, unknown>>;
  findings: Array<Record<string, unknown>>;
  confidence: Record<string, unknown>;
  reinforcingInvestigationIds: string[];
  conflictingInvestigationIds: string[];
  conflicts: Array<Record<string, unknown>>;
  unresolvedLimitations: string[];
  artifactPaths: string[];
  conclusion: string;
};

function asLegacyReport(reportPreview: Record<string, unknown>): LegacySynthesisReport {
  return {
    synthesisId: String(reportPreview.synthesisId),
    synthesisType: String(reportPreview.synthesisType),
    subjectKey: String(reportPreview.subjectKey),
    status: String(reportPreview.status),
    linkedInvestigations: Array.isArray(reportPreview.linkedInvestigations)
      ? reportPreview.linkedInvestigations as Array<Record<string, unknown>>
      : [],
    linkedReasons: Array.isArray(reportPreview.linkedReasons)
      ? reportPreview.linkedReasons as Array<Record<string, unknown>>
      : [],
    findings: Array.isArray(reportPreview.findings) ? reportPreview.findings as Array<Record<string, unknown>> : [],
    confidence: (reportPreview.confidence ?? {}) as Record<string, unknown>,
    reinforcingInvestigationIds: Array.isArray(reportPreview.reinforcingInvestigationIds)
      ? [...reportPreview.reinforcingInvestigationIds as string[]].sort(comparePath)
      : [],
    conflictingInvestigationIds: Array.isArray(reportPreview.conflictingInvestigationIds)
      ? [...reportPreview.conflictingInvestigationIds as string[]].sort(comparePath)
      : [],
    conflicts: Array.isArray(reportPreview.conflicts)
      ? reportPreview.conflicts as Array<Record<string, unknown>>
      : [],
    unresolvedLimitations: Array.isArray(reportPreview.unresolvedLimitations)
      ? [...reportPreview.unresolvedLimitations as string[]].sort(comparePath)
      : [],
    artifactPaths: Array.isArray(reportPreview.artifactPaths)
      ? [...reportPreview.artifactPaths as string[]].sort(comparePath)
      : [],
    conclusion: String(reportPreview.conclusion ?? '')
  };
}

export function createSynthesisInspection(options: {
  projection?: SynthesisProjectionEngine;
  materializer?: SynthesisMaterializer;
  synthesisArtifactsRoot?: string;
  synthesisDefinitionsDir?: string;
  investigationDefinitionsDir?: string;
  investigationsRootDir?: string;
  signalsRootDir?: string;
  investigationArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createSynthesisProjection({
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });

  const materializer = options.materializer ?? createSynthesisMaterializer({
    projection,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });

  function listSynthesisSets(input: { synthesisType?: string; status?: string } = {}) {
    return projection
      .projectAll()
      .filter((entry) => (input.synthesisType
        ? String(entry.reportPreview.synthesisType) === input.synthesisType
        : true))
      .filter((entry) => (input.status ? entry.status.readinessState === input.status : true))
      .map((entry) => {
        const report = asLegacyReport(entry.reportPreview);
        const paths = resolveSynthesisArtifactPaths({ synthesisId: entry.synthesisId, rootDir: options.synthesisArtifactsRoot });
        const artifactPaths = [paths.reportJsonPath, paths.reportMarkdownPath].filter((filePath) => fs.existsSync(filePath));

        return {
          synthesisId: entry.synthesisId,
          synthesisType: report.synthesisType,
          subjectKey: report.subjectKey,
          status: report.status,
          linkedInvestigationCount: report.linkedInvestigations.length,
          confidenceBand: String((report.confidence as { overallBand?: string }).overallBand ?? 'low'),
          artifactPaths: artifactPaths.sort(comparePath)
        };
      })
      .sort((left, right) => left.synthesisId.localeCompare(right.synthesisId));
  }

  function inspectSynthesis(synthesisId: string): LegacySynthesisReport {
    const projected = projection.projectOne(synthesisId);
    return asLegacyReport(projected.reportPreview);
  }

  function inspectLinks(synthesisId: string) {
    const report = inspectSynthesis(synthesisId);
    return {
      synthesisId: report.synthesisId,
      synthesisType: report.synthesisType,
      subjectKey: report.subjectKey,
      linkedInvestigationIds: report.linkedInvestigations
        .map((entry) => String(entry.investigationRunId ?? ''))
        .filter((entry) => entry.length > 0)
        .sort((left, right) => left.localeCompare(right)),
      linkedReasons: [...report.linkedReasons].sort((left, right) => {
        const leftDimension = String(left.dimension ?? '');
        const rightDimension = String(right.dimension ?? '');
        const d = leftDimension.localeCompare(rightDimension);
        if (d !== 0) {
          return d;
        }
        const leftValue = String(left.value ?? '');
        const rightValue = String(right.value ?? '');
        const v = leftValue.localeCompare(rightValue);
        if (v !== 0) {
          return v;
        }
        return String(left.reason ?? '').localeCompare(String(right.reason ?? ''));
      })
    };
  }

  function inspectConfidence(synthesisId: string) {
    const report = inspectSynthesis(synthesisId);
    return {
      synthesisId: report.synthesisId,
      confidence: report.confidence
    };
  }

  function inspectStatus(synthesisId: string): SynthesisStatus {
    const projected = projection.projectOne(synthesisId);
    return projected.status;
  }

  function inspectConflicts(synthesisId: string) {
    const projected = projection.projectOne(synthesisId);
    return {
      synthesisId,
      conflicts: projected.conflicts
    };
  }

  function inspectWhy(synthesisId: string) {
    const projected = projection.projectOne(synthesisId);
    const linkExplanations = Array.isArray(projected.reportPreview.linkExplanations)
      ? projected.reportPreview.linkExplanations
      : [];

    return {
      synthesisId,
      explanations: [...linkExplanations as Array<Record<string, unknown>>].sort((left, right) => {
        const leftId = String(left.linkedInvestigationId ?? '');
        const rightId = String(right.linkedInvestigationId ?? '');
        return leftId.localeCompare(rightId);
      })
    };
  }

  function projectSynthesis(synthesisId: string) {
    return projection.projectOne(synthesisId);
  }

  function materializeSynthesis(synthesisId: string) {
    return materializer.materializeOne(synthesisId);
  }

  function readReport(synthesisId: string): { reportPath: string; content: string } {
    const projected = projection.projectOne(synthesisId);
    const content = [
      '# Cross-Investigation Synthesis Report',
      '',
      `${JSON.stringify(projected.reportPreview, null, 2)}`
    ].join('\n') + '\n';

    const paths = resolveSynthesisArtifactPaths({ synthesisId, rootDir: options.synthesisArtifactsRoot });
    return {
      reportPath: paths.reportMarkdownPath,
      content
    };
  }

  return {
    listSynthesisSets,
    inspectSynthesis,
    inspectLinks,
    inspectConfidence,
    readReport,
    inspectStatus,
    inspectWhy,
    inspectConflicts,
    projectSynthesis,
    materializeSynthesis
  };
}

export type SynthesisInspection = ReturnType<typeof createSynthesisInspection>;
