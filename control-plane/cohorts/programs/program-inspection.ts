import fs from 'node:fs';

import { createInvestigationInspection, type InvestigationInspection } from '../../investigations/investigation-inspection.ts';

import { createCohortProjection, type CohortProjectionEngine } from '../cohort-projection.ts';

import { evaluateProgramCadence } from './program-cadence.ts';
import { createProgramHistoryStore, type ProgramHistoryStore } from './program-history-store.ts';
import { projectCohortLifecycleState, projectProgramLifecycleState } from './program-lifecycle.ts';
import { createCohortProgramLaunchEngine, type CohortProgramLaunchEngine } from './program-launch.ts';
import { createCohortProgramRegistry, type CohortProgramRegistry } from './program-registry.ts';
import { resolveCohortProgramArtifactPaths } from './program-runtime-paths.ts';
import type { CohortLifecycleState, CohortProgramDefinition, CohortProgramLifecycleState, ProgramExecutionHistory } from './program-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function isEscalationConditionSatisfied(input: {
  healthState: string;
  definition: CohortProgramDefinition;
}): boolean {
  if (input.healthState !== 'degraded' && input.healthState !== 'conflicted' && input.healthState !== 'unstable') {
    return false;
  }

  return input.definition.launchConditions.some((condition) => (
    condition.kind === 'cohort_health' && condition.health === input.healthState
  ));
}

export type ProgramStatusProjection = {
  cohortId: string;
  cohortLifecycleState: CohortLifecycleState;
  programs: Array<{
    cohortId: string;
    programId: string;
    displayName: string;
    cadence: CohortProgramDefinition['cadence'];
    lifecycleState: CohortProgramLifecycleState;
    lastExecutionSlot?: string;
    currentSlot: string;
    cadenceDue: boolean;
    cadenceReason: string;
    linkedInvestigationTemplates: string[];
    launchConditionKinds: string[];
  }>;
};

export function createCohortProgramInspection(options: {
  registry?: CohortProgramRegistry;
  projection?: CohortProjectionEngine;
  historyStore?: ProgramHistoryStore;
  launcher?: CohortProgramLaunchEngine;
  investigationInspection?: InvestigationInspection;
  now?: () => Date;
  cohortProgramDefinitionsDir?: string;
  cohortDefinitionsDir?: string;
  cohortArtifactsRoot?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
} = {}) {
  const now = options.now ?? (() => new Date());
  const registry = options.registry ?? createCohortProgramRegistry({ definitionsDir: options.cohortProgramDefinitionsDir });
  const projection = options.projection ?? createCohortProjection({
    definitionsDir: options.cohortDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });
  const investigationInspection = options.investigationInspection ?? createInvestigationInspection({
    rootDir: options.investigationsRootDir,
    definitionsDir: options.investigationDefinitionsDir,
    artifactsRoot: options.investigationArtifactsRoot
  });
  const historyStore = options.historyStore ?? createProgramHistoryStore({
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });
  const launcher = options.launcher ?? createCohortProgramLaunchEngine({
    programRegistry: registry,
    cohortProjection: projection,
    now,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot
  });

  function listPrograms(input: { cohortId: string }) {
    return registry.listPrograms({ cohortId: input.cohortId })
      .map((entry) => ({
        programId: entry.programId,
        cohortId: entry.cohortId,
        displayName: entry.displayName,
        cadence: entry.cadence,
        lifecycleState: entry.lifecycleState,
        enabled: entry.enabled,
        investigationTemplates: [...entry.investigationTemplates].sort((left, right) => left.localeCompare(right)),
        launchConditions: [...entry.launchConditions]
      }))
      .sort((left, right) => left.programId.localeCompare(right.programId));
  }

  function loadProgramHistory(input: { cohortId: string; programId: string }): ProgramExecutionHistory {
    return historyStore.load({ cohortId: input.cohortId, programId: input.programId });
  }

  function inspectProgramHistory(input: { cohortId: string }) {
    const programs = registry.listPrograms({ cohortId: input.cohortId });
    return programs
      .map((program) => loadProgramHistory({ cohortId: input.cohortId, programId: program.programId }))
      .sort((left, right) => left.programId.localeCompare(right.programId));
  }

  function inspectProgramStatus(input: { cohortId: string; slot?: string }): ProgramStatusProjection {
    const cohort = projection.projectOne(input.cohortId).cohort;
    const programs = registry.listPrograms({ cohortId: input.cohortId });

    const programStatuses = programs.map((program) => {
      const history = loadProgramHistory({ cohortId: input.cohortId, programId: program.programId });
      const lifecycleState = projectProgramLifecycleState({
        definition: program,
        historyEntries: history.entries
      });
      const cadence = evaluateProgramCadence({
        program,
        historyEntries: history.entries,
        now: now(),
        ...(input.slot ? { explicitSlot: input.slot } : {})
      });

      return {
        cohortId: input.cohortId,
        programId: program.programId,
        displayName: program.displayName,
        cadence: program.cadence,
        lifecycleState,
        ...(history.entries[0]?.evaluatedSlot ? { lastExecutionSlot: history.entries[0].evaluatedSlot } : {}),
        currentSlot: cadence.currentSlot,
        cadenceDue: cadence.cadenceDue,
        cadenceReason: cadence.cadenceReason,
        linkedInvestigationTemplates: [...program.investigationTemplates].sort((left, right) => left.localeCompare(right)),
        launchConditionKinds: uniqueSorted(program.launchConditions.map((condition) => condition.kind))
      };
    });

    const linkedInvestigationStatuses = cohort.linkedInvestigations
      .map((investigationRunId) => investigationInspection.inspectInvestigation(investigationRunId).record.status)
      .sort((left, right) => left.localeCompare(right));

    const cohortLifecycleState = projectCohortLifecycleState({
      programLifecycleStates: programStatuses.map((entry) => entry.lifecycleState),
      cohortHealthState: cohort.healthState,
      linkedInvestigationStatuses,
      escalationConditionSatisfied: programs.some((program) => isEscalationConditionSatisfied({
        definition: program,
        healthState: cohort.healthState
      }))
    });

    return {
      cohortId: input.cohortId,
      cohortLifecycleState,
      programs: programStatuses.sort((left, right) => left.programId.localeCompare(right.programId))
    };
  }

  function runProgram(input: { programId: string; slot?: string }) {
    return launcher.runProgram({
      programId: input.programId,
      ...(input.slot ? { slot: input.slot } : {})
    });
  }

  function readProgramReport(input: { cohortId: string; programId: string }): { reportPath: string; content: string } {
    const paths = resolveCohortProgramArtifactPaths({
      cohortId: input.cohortId,
      programId: input.programId,
      rootDir: options.cohortArtifactsRoot
    });

    if (!fs.existsSync(paths.reportMarkdownPath)) {
      throw new Error(`COHORT_PROGRAM_REPORT_NOT_FOUND: ${paths.reportMarkdownPath}`);
    }

    return {
      reportPath: paths.reportMarkdownPath,
      content: fs.readFileSync(paths.reportMarkdownPath, 'utf8')
    };
  }

  return {
    listPrograms,
    inspectProgramHistory,
    inspectProgramStatus,
    runProgram,
    readProgramReport
  };
}

export type CohortProgramInspection = ReturnType<typeof createCohortProgramInspection>;
