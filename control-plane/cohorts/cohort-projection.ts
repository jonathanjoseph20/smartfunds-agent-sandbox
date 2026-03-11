import { createInvestigationInspection, type InvestigationInspection } from '../investigations/investigation-inspection.ts';
import { createInvestigationStore, type InvestigationStore } from '../investigations/investigation-store.ts';
import { createSynthesisInspection, type SynthesisInspection } from '../synthesis/synthesis-inspection.ts';

import { createCohortLinker, type CohortLinker } from './cohort-linker.ts';
import { createCohortRegistry, type CohortRegistry } from './cohort-registry.ts';
import { classifyCohortHealth } from './cohort-health.ts';
import { evaluateCohortReadiness } from './cohort-readiness.ts';
import type { ResearchCohort } from './cohort-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function countRestarts(history: Array<{ eventType: string; toStatus?: string }>): number {
  return history.filter((entry) => entry.eventType === 'PHASE_RETRY_SCHEDULED').length;
}

function compareById(left: { investigationRunId: string }, right: { investigationRunId: string }): number {
  return left.investigationRunId.localeCompare(right.investigationRunId);
}

export interface CohortProjectionResult {
  cohortId: string;
  cohort: ResearchCohort;
  conflicts: string[];
  reportPreview: Record<string, unknown>;
  statusPreview: Record<string, unknown>;
}

export function createCohortProjection(options: {
  registry?: CohortRegistry;
  linker?: CohortLinker;
  investigationInspection?: InvestigationInspection;
  synthesisInspection?: SynthesisInspection;
  investigationStore?: InvestigationStore;
  definitionsDir?: string;
  investigationsRootDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  investigationDefinitionsDir?: string;
  investigationArtifactsRoot?: string;
  synthesisArtifactsRoot?: string;
  cohortArtifactsRoot?: string;
} = {}) {
  const registry = options.registry ?? createCohortRegistry({ definitionsDir: options.definitionsDir });
  const linker = options.linker ?? createCohortLinker({
    registry,
    definitionsDir: options.definitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });
  const investigationInspection = options.investigationInspection ?? createInvestigationInspection({
    definitionsDir: options.investigationDefinitionsDir,
    rootDir: options.investigationsRootDir,
    artifactsRoot: options.investigationArtifactsRoot
  });
  const synthesisInspection = options.synthesisInspection ?? createSynthesisInspection({
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });
  const investigationStore = options.investigationStore ?? createInvestigationStore({ rootDir: options.investigationsRootDir });

  function projectOne(cohortId: string): CohortProjectionResult {
    const definition = registry.getCohortDefinition(cohortId);
    const link = linker.buildLinks().find((entry) => entry.cohortId === cohortId);
    if (!link) {
      throw new Error(`COHORT_NOT_FOUND: ${cohortId}`);
    }

    const linkedInvestigations = [...link.linkedInvestigations].sort((left, right) => left.localeCompare(right));
    const linkedSyntheses = [...link.linkedSyntheses].sort((left, right) => left.localeCompare(right));

    const investigationSnapshots = linkedInvestigations
      .map((investigationRunId) => {
        const inspected = investigationInspection.inspectInvestigation(investigationRunId);
        const completion = investigationInspection.inspectCompletionStatus(investigationRunId);
        const history = investigationStore.getInvestigationHistory(investigationRunId);
        return {
          investigationRunId,
          status: inspected.record.status,
          readinessState: completion.readinessState,
          healthState: completion.healthState,
          blockingReasons: [...completion.blockingReasons].sort((left, right) => left.localeCompare(right)),
          limitations: [...completion.limitations].sort((left, right) => left.localeCompare(right)),
          restartCount: countRestarts(history)
        };
      })
      .sort(compareById);

    const synthesisSnapshots = linkedSyntheses
      .map((synthesisId) => {
        const summary = synthesisInspection.listSynthesisSets().find((entry) => entry.synthesisId === synthesisId);
        const status = synthesisInspection.inspectStatus(synthesisId);
        const conflicts = synthesisInspection.inspectConflicts(synthesisId);

        return {
          synthesisId,
          synthesisType: summary?.synthesisType ?? 'unknown',
          subjectKey: summary?.subjectKey ?? 'unknown',
          readinessState: status.readinessState,
          conflictCount: conflicts.conflicts.length
        };
      })
      .sort((left, right) => left.synthesisId.localeCompare(right.synthesisId));

    const synthesisConflictCount = synthesisSnapshots.reduce((total, item) => total + item.conflictCount, 0);
    const conflicts = uniqueSorted(synthesisSnapshots
      .filter((entry) => entry.conflictCount > 0)
      .map((entry) => `synthesis conflict count for ${entry.synthesisId}: ${String(entry.conflictCount)}`));

    const readiness = evaluateCohortReadiness({
      linkedInvestigationIds: linkedInvestigations,
      linkedSynthesisIds: linkedSyntheses,
      investigationStatuses: investigationSnapshots.map((entry) => entry.status),
      investigationReadinessStates: investigationSnapshots.map((entry) => entry.readinessState),
      synthesisReadinessStates: synthesisSnapshots.map((entry) => entry.readinessState),
      synthesisConflictCount,
      limitations: [...investigationSnapshots.flatMap((entry) => entry.limitations), ...conflicts]
    });

    const health = classifyCohortHealth({
      investigationReadinessStates: investigationSnapshots.map((entry) => entry.readinessState),
      synthesisReadinessStates: synthesisSnapshots.map((entry) => entry.readinessState),
      synthesisConflictCount,
      restartCount: investigationSnapshots.reduce((total, item) => total + item.restartCount, 0)
    });

    const cohort: ResearchCohort = {
      cohortId: definition.cohortId,
      cohortType: definition.cohortType,
      subjectKey: definition.subjectKey,
      linkedInvestigations,
      linkedSyntheses,
      readinessState: readiness.readinessState,
      healthState: health.healthState,
      strengths: uniqueSorted([...readiness.strengths, ...health.strengths]),
      limitations: uniqueSorted([...readiness.limitations, ...health.limitations])
    };

    const statusPreview = {
      cohortId,
      readiness: cohort.readinessState,
      health: cohort.healthState,
      strengths: cohort.strengths,
      limitations: cohort.limitations
    } as Record<string, unknown>;

    const reportPreview = {
      cohort,
      linkedInvestigationDetails: investigationSnapshots,
      linkedSynthesisDetails: synthesisSnapshots,
      conflicts
    } as Record<string, unknown>;

    return {
      cohortId,
      cohort,
      conflicts,
      statusPreview,
      reportPreview
    };
  }

  function projectAll(): CohortProjectionResult[] {
    return registry.listCohorts()
      .map((entry) => projectOne(entry.cohortId))
      .sort((left, right) => left.cohortId.localeCompare(right.cohortId));
  }

  return {
    projectOne,
    projectAll
  };
}

export type CohortProjectionEngine = ReturnType<typeof createCohortProjection>;
