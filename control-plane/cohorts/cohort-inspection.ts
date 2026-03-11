import { createCohortLinker, type CohortLinker } from './cohort-linker.ts';
import { createCohortMaterializer, type CohortMaterializer } from './cohort-materializer.ts';
import { createCohortProjection, type CohortProjectionEngine } from './cohort-projection.ts';
import { createCohortRegistry, type CohortRegistry } from './cohort-registry.ts';
import { createCohortEscalationInspection, type CohortEscalationInspection } from './escalation/cohort-escalation-inspection.ts';
import { createProgramAutomationInspection, type ProgramAutomationInspection } from './programs/program-automation-inspection.ts';
import { createCohortProgramInspection, type CohortProgramInspection } from './programs/program-inspection.ts';

export function createCohortInspection(options: {
  registry?: CohortRegistry;
  linker?: CohortLinker;
  projection?: CohortProjectionEngine;
  materializer?: CohortMaterializer;
  programInspection?: CohortProgramInspection;
  escalationInspection?: CohortEscalationInspection;
  automationInspection?: ProgramAutomationInspection;
  cohortProgramDefinitionsDir?: string;
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
  const projection = options.projection ?? createCohortProjection({
    registry,
    linker,
    definitionsDir: options.definitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });
  const materializer = options.materializer ?? createCohortMaterializer({
    projection,
    definitionsDir: options.definitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });
  const programInspection = options.programInspection ?? createCohortProgramInspection({
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortDefinitionsDir: options.definitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });
  const escalationInspection = options.escalationInspection ?? createCohortEscalationInspection({
    cohortDefinitionsDir: options.definitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });
  const automationInspection = options.automationInspection ?? createProgramAutomationInspection({
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortDefinitionsDir: options.definitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });

  function listCohorts() {
    return registry.listCohorts()
      .map((entry) => ({
        cohortId: entry.cohortId,
        cohortType: entry.cohortType,
        subjectKey: entry.subjectKey
      }))
      .sort((left, right) => left.cohortId.localeCompare(right.cohortId));
  }

  function inspectCohort(cohortId: string) {
    const definition = registry.getCohortDefinition(cohortId);
    const links = linker.buildLinks().find((entry) => entry.cohortId === cohortId);

    return {
      definition,
      linkedInvestigations: links?.linkedInvestigations ?? [],
      linkedSyntheses: links?.linkedSyntheses ?? []
    };
  }

  function inspectLinks(cohortId: string) {
    const details = inspectCohort(cohortId);
    return {
      cohortId,
      linkedInvestigations: details.linkedInvestigations,
      linkedSyntheses: details.linkedSyntheses
    };
  }

  function inspectStatus(cohortId: string) {
    const projected = projection.projectOne(cohortId);
    return {
      cohortId,
      readiness: projected.cohort.readinessState,
      health: projected.cohort.healthState
    };
  }

  function projectCohort(cohortId: string) {
    return projection.projectOne(cohortId).cohort;
  }

  function materializeCohort(cohortId: string) {
    return materializer.materializeOne(cohortId);
  }

  function listCohortPrograms(cohortId: string) {
    return programInspection.listPrograms({ cohortId });
  }

  function inspectCohortProgramStatus(cohortId: string, slot?: string) {
    return programInspection.inspectProgramStatus({
      cohortId,
      ...(slot ? { slot } : {})
    });
  }

  function inspectCohortProgramHistory(cohortId: string) {
    return programInspection.inspectProgramHistory({ cohortId });
  }

  function runCohortProgram(programId: string, slot?: string) {
    return programInspection.runProgram({
      programId,
      ...(slot ? { slot } : {})
    });
  }

  function evaluateCohortPrograms(input: { cohortId?: string; slot: string }) {
    return automationInspection.evaluatePrograms(input);
  }

  function inspectCohortAutomationStatus(input: { cohortId: string; slot: string }) {
    return automationInspection.inspectAutomationStatus(input);
  }

  function inspectCohortProgramAutomationHistory(input: { cohortId: string; programId?: string }) {
    return automationInspection.inspectProgramHistory(input);
  }

  function inspectCohortEscalation(input: { cohortId: string; slotOrReference?: string }) {
    return escalationInspection.inspectOne(input);
  }

  function evaluateCohortEscalation(input: { cohortId: string; slotOrReference?: string }) {
    return escalationInspection.evaluateOne(input);
  }

  function inspectCohortEscalationHistory(cohortId: string) {
    return escalationInspection.inspectHistory({ cohortId });
  }

  return {
    listCohorts,
    inspectCohort,
    inspectStatus,
    inspectLinks,
    projectCohort,
    materializeCohort,
    listCohortPrograms,
    inspectCohortProgramStatus,
    inspectCohortProgramHistory,
    runCohortProgram,
    evaluateCohortPrograms,
    inspectCohortAutomationStatus,
    inspectCohortProgramAutomationHistory,
    inspectCohortEscalation,
    evaluateCohortEscalation,
    inspectCohortEscalationHistory
  };
}

export type CohortInspection = ReturnType<typeof createCohortInspection>;
