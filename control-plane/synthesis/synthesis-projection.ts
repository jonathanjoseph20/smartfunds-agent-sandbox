import fs from 'node:fs';

import { computeSynthesisConfidence } from './synthesis-confidence.ts';
import { classifySynthesisConflicts, type SynthesisConflict } from './synthesis-conflict-classifier.ts';
import { createSynthesisLinkExplanations, type SynthesisLinkExplanation, type SynthesisLinkExplanationEngine } from './synthesis-link-explanations.ts';
import { createSynthesisLinker, type SynthesisLinker } from './synthesis-linker.ts';
import { resolveSynthesisArtifactPaths } from './synthesis-runtime-paths.ts';
import { evaluateSynthesisStatus, type SynthesisStatus } from './synthesis-status.ts';
import type { LinkedInvestigationProjection, SynthesisReport } from './synthesis-types.ts';
import { createInvestigationInspection, type InvestigationInspection } from '../investigations/investigation-inspection.ts';

export interface SynthesisProjection {
  synthesisId: string;
  status: SynthesisStatus;
  conflicts: SynthesisConflict[];
  reportPreview: Record<string, unknown>;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseFinding(findingId: string): { key: string; value: string } {
  const segments = findingId.split(':');
  const key = `${segments[0] ?? findingId}:${segments[1] ?? 'unknown'}`;
  const value = segments.length > 2 ? segments.slice(2).join(':') : (segments[1] ?? 'unknown');
  return { key, value };
}

function projectLinkedInvestigations(inspection: InvestigationInspection, investigationRunIds: string[]): LinkedInvestigationProjection[] {
  return investigationRunIds
    .map((investigationRunId) => {
      const inspected = inspection.inspectInvestigation(investigationRunId);
      const confidence = inspection.inspectConfidence(investigationRunId);
      const completion = inspection.inspectCompletionStatus(investigationRunId);

      return {
        investigationRunId,
        investigationDefinitionId: inspected.record.investigationDefinitionId,
        sourceSignalType: inspected.record.sourceSignalType,
        sourceSignalReference: inspected.record.sourceSignalReference,
        ...(inspected.record.sourceTriggerId ? { sourceTriggerId: inspected.record.sourceTriggerId } : {}),
        status: inspected.record.status,
        findings: [...inspected.record.findings].sort((left, right) => left.localeCompare(right)),
        reportConfidenceBand: confidence.reportConfidence.confidenceBand,
        readinessState: completion.readinessState,
        convergenceState: completion.convergenceState,
        healthState: completion.healthState,
        blockingReasons: [...completion.blockingReasons].sort((left, right) => left.localeCompare(right)),
        strengths: [...completion.strengths].sort((left, right) => left.localeCompare(right)),
        limitations: [...completion.limitations].sort((left, right) => left.localeCompare(right))
      } satisfies LinkedInvestigationProjection;
    })
    .sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));
}

function buildReinforcingInvestigations(linkedInvestigations: LinkedInvestigationProjection[]): string[] {
  const byFinding = new Map<string, string[]>();
  for (const investigation of linkedInvestigations) {
    for (const finding of investigation.findings) {
      const existing = byFinding.get(finding) ?? [];
      byFinding.set(finding, uniqueSorted([...existing, investigation.investigationRunId]));
    }
  }

  return uniqueSorted(
    Array.from(byFinding.values())
      .filter((ids) => ids.length >= 2)
      .flatMap((ids) => ids)
  );
}

function buildPreviewFindings(linkedInvestigations: LinkedInvestigationProjection[], conflicts: SynthesisConflict[]): Array<Record<string, unknown>> {
  const allFindingIds = uniqueSorted(linkedInvestigations.flatMap((entry) => entry.findings));

  return allFindingIds.map((findingId) => {
    const supportingInvestigationIds = linkedInvestigations
      .filter((entry) => entry.findings.includes(findingId))
      .map((entry) => entry.investigationRunId)
      .sort((left, right) => left.localeCompare(right));

    const related = conflicts.filter((entry) => (entry.findingIds ?? []).includes(findingId));
    const conflictingInvestigationIds = uniqueSorted(related.flatMap((entry) => entry.investigationIds));
    const conflictingFindingIds = uniqueSorted(related.flatMap((entry) => (entry.findingIds ?? []).filter((id) => id !== findingId)));

    return {
      findingId,
      title: findingId.replace(/[:_]/g, ' '),
      summary: `Aggregated finding derived from linked investigations for ${findingId}.`,
      supportingInvestigationIds,
      conflictingInvestigationIds,
      supportingFindingIds: [findingId],
      conflictingFindingIds,
      confidenceBand: conflictingInvestigationIds.length > 0 ? 'low' : (supportingInvestigationIds.length >= 2 ? 'high' : 'medium'),
      strengths: supportingInvestigationIds.length >= 2
        ? ['cross-investigation reinforcement present']
        : supportingInvestigationIds.length > 0
          ? [`supporting investigations: ${String(supportingInvestigationIds.length)}`]
          : [],
      limitations: conflictingInvestigationIds.length > 0
        ? [`conflicting investigations: ${String(conflictingInvestigationIds.length)}`]
        : []
    };
  });
}

function conclude(status: SynthesisStatus['readinessState']): string {
  if (status === 'completed') {
    return 'Synthesis completed: projection has been materialized and finalized.';
  }
  if (status === 'ready') {
    return 'Synthesis ready: linked investigations converge with sufficient support for materialization.';
  }
  if (status === 'active') {
    return 'Synthesis active: linked investigations are in progress and aggregate confidence remains provisional.';
  }
  if (status === 'incomplete') {
    return 'Synthesis incomplete: completed investigation support is not yet sufficient.';
  }
  if (status === 'inconclusive') {
    return 'Synthesis inconclusive: unresolved conflicts or weak support require operator review.';
  }
  return 'Synthesis pending: no linked investigations are available for projection.';
}

export function createSynthesisProjection(options: {
  linker?: SynthesisLinker;
  inspection?: InvestigationInspection;
  linkExplanations?: SynthesisLinkExplanationEngine;
  synthesisDefinitionsDir?: string;
  investigationDefinitionsDir?: string;
  investigationsRootDir?: string;
  signalsRootDir?: string;
  investigationArtifactsRoot?: string;
  synthesisArtifactsRoot?: string;
} = {}) {
  const linker = options.linker ?? createSynthesisLinker({
    definitionsDir: options.synthesisDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir
  });

  const inspection = options.inspection ?? createInvestigationInspection({
    definitionsDir: options.investigationDefinitionsDir,
    rootDir: options.investigationsRootDir,
    artifactsRoot: options.investigationArtifactsRoot
  });

  const linkExplanations = options.linkExplanations ?? createSynthesisLinkExplanations({
    definitionsDir: options.synthesisDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir
  });

  function projectOne(synthesisId: string): SynthesisProjection {
    const links = linker.buildLinks();
    const link = links.find((entry) => entry.synthesisId === synthesisId);
    if (!link) {
      throw new Error(`SYNTHESIS_NOT_FOUND: ${synthesisId}`);
    }

    const linkedInvestigations = projectLinkedInvestigations(inspection, link.linkedInvestigationIds);
    const conflicts = classifySynthesisConflicts({
      synthesisId: link.synthesisId,
      linkedInvestigations
    });

    const reinforcingInvestigationIds = buildReinforcingInvestigations(linkedInvestigations);
    const unresolvedLimitations = uniqueSorted([
      ...linkedInvestigations.flatMap((entry) => entry.limitations),
      ...linkedInvestigations.flatMap((entry) => entry.blockingReasons)
    ]);

    const confidence = computeSynthesisConfidence({
      linkedInvestigations,
      reinforcingInvestigationIds,
      conflicts: conflicts.map((entry) => ({
        conflictId: entry.conflictId,
        summary: entry.summary,
        conflictingInvestigationIds: entry.investigationIds,
        conflictingFindingIds: entry.findingIds ?? []
      })),
      unresolvedLimitations
    });

    const artifactPaths = resolveSynthesisArtifactPaths({
      synthesisId: link.synthesisId,
      rootDir: options.synthesisArtifactsRoot
    });
    const materialized = fs.existsSync(artifactPaths.reportJsonPath);

    const status = evaluateSynthesisStatus({
      synthesisId: link.synthesisId,
      linkedInvestigations,
      conflicts,
      materialized
    });

    const conflictsForLegacy: SynthesisReport['conflicts'] = conflicts.map((entry) => ({
      conflictId: entry.conflictId,
      summary: entry.summary,
      conflictingInvestigationIds: entry.investigationIds,
      conflictingFindingIds: entry.findingIds ?? []
    }));

    const linkedReasons = [...link.linkedReasons].sort((left, right) => {
      const dim = left.dimension.localeCompare(right.dimension);
      if (dim !== 0) {
        return dim;
      }
      const valueCmp = left.value.localeCompare(right.value);
      if (valueCmp !== 0) {
        return valueCmp;
      }
      return left.reason.localeCompare(right.reason);
    });

    const findings = buildPreviewFindings(linkedInvestigations, conflicts);
    const conflictingInvestigationIds = uniqueSorted(conflicts.flatMap((entry) => entry.investigationIds));

    const reportPreview = {
      synthesisId: link.synthesisId,
      synthesisType: link.synthesisType,
      subjectKey: link.subjectKey,
      status: status.readinessState,
      linkedInvestigations,
      linkedReasons,
      linkExplanations: linkExplanations.explainLinksForSynthesis({
        synthesisId: link.synthesisId,
        synthesisType: link.synthesisType,
        subjectKey: link.subjectKey,
        linkedInvestigationIds: link.linkedInvestigationIds
      }) satisfies SynthesisLinkExplanation[],
      findings,
      confidence,
      reinforcingInvestigationIds,
      conflictingInvestigationIds,
      conflicts: conflictsForLegacy,
      unresolvedLimitations,
      artifactPaths: [artifactPaths.reportJsonPath, artifactPaths.reportMarkdownPath],
      conclusion: conclude(status.readinessState)
    } as Record<string, unknown>;

    return {
      synthesisId: link.synthesisId,
      status,
      conflicts,
      reportPreview
    };
  }

  function projectAll(): SynthesisProjection[] {
    return linker
      .buildLinks()
      .map((entry) => projectOne(entry.synthesisId))
      .sort((left, right) => left.synthesisId.localeCompare(right.synthesisId));
  }

  return {
    projectOne,
    projectAll
  };
}

export type SynthesisProjectionEngine = ReturnType<typeof createSynthesisProjection>;
