import path from 'node:path';

import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import { createInvestigationInspection, type InvestigationInspection } from '../investigations/investigation-inspection.ts';

import { computeSynthesisConfidence } from './synthesis-confidence.ts';
import { createSynthesisLinker, type SynthesisLinkProjection, type SynthesisLinker } from './synthesis-linker.ts';
import { writeSynthesisReport } from './synthesis-report.ts';
import { createSynthesisStore, type SynthesisStore } from './synthesis-store.ts';
import {
  SynthesisError,
  type LinkedInvestigationProjection,
  type SynthesisConflict,
  type SynthesisFinding,
  type SynthesisReport,
  type SynthesisStatus
} from './synthesis-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function todayUtcIsoDate(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function isCompletedOrReady(row: LinkedInvestigationProjection): boolean {
  if (row.status === 'completed') {
    return true;
  }
  return row.readinessState === 'complete' || row.readinessState === 'ready_to_finalize';
}

type ParsedFinding = {
  findingId: string;
  family: string;
  subject: string;
  value: string;
  key: string;
};

function parseFinding(findingId: string): ParsedFinding {
  const segments = findingId.split(':');
  const family = segments[0] ?? findingId;
  const subject = segments[1] ?? 'unknown';
  const value = segments.length >= 3 ? segments.slice(2).join(':') : (segments[1] ?? 'unknown');
  return {
    findingId,
    family,
    subject,
    value,
    key: `${family}:${subject}`
  };
}

function buildConflicts(input: {
  linkedInvestigations: LinkedInvestigationProjection[];
}): SynthesisConflict[] {
  const byKey = new Map<string, Map<string, { investigationIds: string[]; findingIds: string[] }>>();

  for (const investigation of input.linkedInvestigations) {
    for (const findingId of investigation.findings) {
      const parsed = parseFinding(findingId);
      const values = byKey.get(parsed.key) ?? new Map<string, { investigationIds: string[]; findingIds: string[] }>();
      const bucket = values.get(parsed.value) ?? { investigationIds: [], findingIds: [] };
      bucket.investigationIds = uniqueSorted([...bucket.investigationIds, investigation.investigationRunId]);
      bucket.findingIds = uniqueSorted([...bucket.findingIds, findingId]);
      values.set(parsed.value, bucket);
      byKey.set(parsed.key, values);
    }
  }

  const conflicts: SynthesisConflict[] = [];
  for (const [key, values] of byKey.entries()) {
    const distinctValues = Array.from(values.keys()).sort((left, right) => left.localeCompare(right));
    if (distinctValues.length <= 1) {
      continue;
    }

    const conflictingInvestigationIds = uniqueSorted(
      distinctValues.flatMap((value) => values.get(value)?.investigationIds ?? [])
    );
    const conflictingFindingIds = uniqueSorted(
      distinctValues.flatMap((value) => values.get(value)?.findingIds ?? [])
    );

    const conflictId = sha256(canonicalStringify({ key, distinctValues }));
    conflicts.push({
      conflictId,
      summary: `conflicting findings for ${key}: ${distinctValues.join(' vs ')}`,
      conflictingInvestigationIds,
      conflictingFindingIds
    });
  }

  return conflicts.sort((left, right) => left.conflictId.localeCompare(right.conflictId));
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

function classifyFindingBand(input: {
  supportingCount: number;
  conflictingCount: number;
}): 'low' | 'medium' | 'high' {
  if (input.conflictingCount > 0) {
    return 'low';
  }
  if (input.supportingCount >= 2) {
    return 'high';
  }
  if (input.supportingCount === 1) {
    return 'medium';
  }
  return 'low';
}

function findingTitle(findingId: string): string {
  return findingId.replace(/[:_]/g, ' ');
}

function buildFindings(input: {
  linkedInvestigations: LinkedInvestigationProjection[];
  conflicts: SynthesisConflict[];
}): SynthesisFinding[] {
  const allFindingIds = uniqueSorted(input.linkedInvestigations.flatMap((entry) => entry.findings));

  return allFindingIds.map((findingId) => {
    const supportingInvestigations = input.linkedInvestigations
      .filter((entry) => entry.findings.includes(findingId))
      .map((entry) => entry.investigationRunId)
      .sort((left, right) => left.localeCompare(right));

    const relatedConflicts = input.conflicts.filter((conflict) => conflict.conflictingFindingIds.includes(findingId));
    const conflictingInvestigations = uniqueSorted(relatedConflicts.flatMap((entry) => entry.conflictingInvestigationIds));
    const conflictingFindingIds = uniqueSorted(relatedConflicts.flatMap((entry) => entry.conflictingFindingIds.filter((id) => id !== findingId)));

    const confidenceBand = classifyFindingBand({
      supportingCount: supportingInvestigations.length,
      conflictingCount: conflictingInvestigations.length
    });

    const strengths: string[] = [];
    const limitations: string[] = [];

    if (supportingInvestigations.length > 0) {
      strengths.push(`supporting investigations: ${String(supportingInvestigations.length)}`);
    }
    if (supportingInvestigations.length >= 2) {
      strengths.push('cross-investigation reinforcement present');
    }
    if (conflictingInvestigations.length > 0) {
      limitations.push(`conflicting investigations: ${String(conflictingInvestigations.length)}`);
    }
    if (supportingInvestigations.length < input.linkedInvestigations.length) {
      limitations.push('not observed across all linked investigations');
    }

    return {
      findingId,
      title: findingTitle(findingId),
      summary: `Aggregated finding derived from linked investigations for ${findingId}.`,
      supportingInvestigationIds: supportingInvestigations,
      conflictingInvestigationIds: conflictingInvestigations,
      supportingFindingIds: [findingId],
      conflictingFindingIds,
      confidenceBand,
      strengths: uniqueSorted(strengths),
      limitations: uniqueSorted(limitations)
    };
  });
}

function classifyStatus(input: {
  linkedInvestigations: LinkedInvestigationProjection[];
  conflicts: SynthesisConflict[];
  confidenceBand: 'low' | 'medium' | 'high';
}): SynthesisStatus {
  const total = input.linkedInvestigations.length;
  const completed = input.linkedInvestigations.filter(isCompletedOrReady).length;

  if (total === 0) {
    return 'pending';
  }
  if (input.conflicts.length > 0) {
    return 'inconclusive';
  }
  if (completed === 0) {
    return 'pending';
  }
  if (completed < total) {
    return 'active';
  }
  if (input.confidenceBand === 'low') {
    return 'inconclusive';
  }
  return 'completed';
}

function conclude(status: SynthesisStatus): string {
  if (status === 'completed') {
    return 'Synthesis complete: linked investigations converge with sufficient support.';
  }
  if (status === 'active') {
    return 'Synthesis active: linked investigations are partially complete and aggregate confidence remains provisional.';
  }
  if (status === 'inconclusive') {
    return 'Synthesis inconclusive: material conflicts or weak aggregate support require operator review.';
  }
  return 'Synthesis pending: insufficient linked investigation readiness to compute aggregate conclusions.';
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((entry, index) => entry === right[index]);
}

function sameReasons(
  left: Array<{ dimension: string; value: string; reason: string }>,
  right: Array<{ dimension: string; value: string; reason: string }>
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((entry, index) => (
    entry.dimension === right[index]?.dimension
    && entry.value === right[index]?.value
    && entry.reason === right[index]?.reason
  ));
}

export function createSynthesisEngine(options: {
  linker?: SynthesisLinker;
  store?: SynthesisStore;
  inspection?: InvestigationInspection;
  now?: () => Date;
  synthesisRootDir?: string;
  synthesisArtifactsRoot?: string;
  synthesisDefinitionsDir?: string;
  investigationDefinitionsDir?: string;
  investigationsRootDir?: string;
  signalsRootDir?: string;
  investigationArtifactsRoot?: string;
} = {}) {
  const linker = options.linker ?? createSynthesisLinker({
    definitionsDir: options.synthesisDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir
  });
  const store = options.store ?? createSynthesisStore({ rootDir: options.synthesisRootDir });
  const inspection = options.inspection ?? createInvestigationInspection({
    rootDir: options.investigationsRootDir,
    artifactsRoot: options.investigationArtifactsRoot,
    definitionsDir: options.investigationDefinitionsDir
  });
  const synthesisArtifactsRoot = path.resolve(options.synthesisArtifactsRoot ?? path.join('artifacts', 'synthesis'));
  const now = options.now ?? (() => new Date());

  function projectLinkedInvestigations(investigationRunIds: string[]): LinkedInvestigationProjection[] {
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
        };
      })
      .sort((left, right) => left.investigationRunId.localeCompare(right.investigationRunId));
  }

  function upsertSynthesisSet(link: SynthesisLinkProjection, logDate: string): void {
    let existing = null;
    try {
      existing = store.getSynthesisSet(link.synthesisId);
    } catch (error) {
      const message = (error as Error).message;
      if (!message.includes('Synthesis set not found')) {
        throw error;
      }
    }

    if (!existing) {
      store.appendEvent({
        logDate,
        event: {
          eventType: 'SYNTHESIS_SET_CREATED',
          synthesisId: link.synthesisId,
          synthesisType: link.synthesisType,
          subjectKey: link.subjectKey,
          status: 'pending',
          linkedInvestigationIds: link.linkedInvestigationIds,
          linkedReasons: link.linkedReasons
        }
      });
      return;
    }

    if (!sameStringArray(existing.linkedInvestigationIds, link.linkedInvestigationIds)
      || !sameReasons(existing.linkedReasons, link.linkedReasons)) {
      store.appendEvent({
        logDate,
        event: {
          eventType: 'SYNTHESIS_LINKS_UPDATED',
          synthesisId: link.synthesisId,
          linkedInvestigationIds: link.linkedInvestigationIds,
          linkedReasons: link.linkedReasons
        }
      });
    }
  }

  function runSynthesisForLink(link: SynthesisLinkProjection, logDate: string): SynthesisReport {
    upsertSynthesisSet(link, logDate);

    const linkedInvestigations = projectLinkedInvestigations(link.linkedInvestigationIds);
    const conflicts = buildConflicts({ linkedInvestigations });
    const reinforcingInvestigationIds = buildReinforcingInvestigations(linkedInvestigations);
    const findings = buildFindings({ linkedInvestigations, conflicts });

    const unresolvedLimitations = uniqueSorted([
      ...linkedInvestigations.flatMap((entry) => entry.limitations),
      ...linkedInvestigations.flatMap((entry) => entry.blockingReasons)
    ]);

    const confidence = computeSynthesisConfidence({
      linkedInvestigations,
      reinforcingInvestigationIds,
      conflicts,
      unresolvedLimitations
    });

    const status = classifyStatus({
      linkedInvestigations,
      conflicts,
      confidenceBand: confidence.overallBand
    });

    const conflictingInvestigationIds = uniqueSorted(conflicts.flatMap((entry) => entry.conflictingInvestigationIds));

    const previous = store.getSynthesisSet(link.synthesisId);
    if (previous.status !== status) {
      store.appendEvent({
        logDate,
        event: {
          eventType: 'SYNTHESIS_STATUS_UPDATED',
          synthesisId: link.synthesisId,
          status,
          reason: `status_derived:${status}`
        }
      });
    }

    if (previous.latestConfidenceBand !== confidence.overallBand) {
      store.appendEvent({
        logDate,
        event: {
          eventType: 'SYNTHESIS_CONFIDENCE_UPDATED',
          synthesisId: link.synthesisId,
          overallBand: confidence.overallBand
        }
      });
    }

    const reportSkeleton: SynthesisReport = {
      synthesisId: link.synthesisId,
      synthesisType: link.synthesisType,
      subjectKey: link.subjectKey,
      status,
      linkedInvestigations,
      linkedReasons: link.linkedReasons,
      findings,
      confidence,
      reinforcingInvestigationIds,
      conflictingInvestigationIds,
      conflicts,
      unresolvedLimitations,
      artifactPaths: [],
      conclusion: conclude(status)
    };

    const written = writeSynthesisReport({
      report: reportSkeleton,
      artifactsRoot: synthesisArtifactsRoot
    });

    const nextArtifactPaths = uniqueSorted([written.jsonPath, written.markdownPath]);
    const finalizedReport: SynthesisReport = {
      ...reportSkeleton,
      artifactPaths: nextArtifactPaths
    };
    writeSynthesisReport({
      report: finalizedReport,
      artifactsRoot: synthesisArtifactsRoot
    });
    const history = store.getSynthesisHistory(link.synthesisId);
    const existingArtifactPaths = new Set(
      history
        .filter((event) => event.eventType === 'SYNTHESIS_ARTIFACT_RECORDED')
        .map((event) => event.artifactPath)
    );

    for (const artifactPath of nextArtifactPaths) {
      if (!existingArtifactPaths.has(artifactPath)) {
        store.appendEvent({
          logDate,
          event: {
            eventType: 'SYNTHESIS_ARTIFACT_RECORDED',
            synthesisId: link.synthesisId,
            artifactPath,
            artifactKind: artifactPath.endsWith('.md') ? 'markdown' : 'json'
          }
        });
      }
    }

    return finalizedReport;
  }

  function runAll(): SynthesisReport[] {
    const logDate = todayUtcIsoDate(now());
    const links = linker.buildLinks();

    return links
      .map((link) => runSynthesisForLink(link, logDate))
      .sort((left, right) => {
        const typeCmp = left.synthesisType.localeCompare(right.synthesisType);
        if (typeCmp !== 0) {
          return typeCmp;
        }
        return left.subjectKey.localeCompare(right.subjectKey);
      });
  }

  function runOne(synthesisId: string): SynthesisReport {
    const logDate = todayUtcIsoDate(now());
    const links = linker.buildLinks();
    const found = links.find((link) => link.synthesisId === synthesisId);
    if (!found) {
      throw new SynthesisError('SYNTHESIS_NOT_FOUND', `Synthesis set not found for run: ${synthesisId}`);
    }
    return runSynthesisForLink(found, logDate);
  }

  return {
    runAll,
    runOne
  };
}

export type SynthesisEngine = ReturnType<typeof createSynthesisEngine>;
