import { createCohortProgramRegistry, type CohortProgramRegistry } from './program-registry.ts';
import { createProgramAutomationEvaluator, type ProgramAutomationEvaluator } from './program-automation-evaluator.ts';
import { createProgramAutomationHistoryStore, type ProgramAutomationHistoryStore } from './program-automation-history-store.ts';

export function createProgramAutomationInspection(options: {
  evaluator?: ProgramAutomationEvaluator;
  historyStore?: ProgramAutomationHistoryStore;
  registry?: CohortProgramRegistry;
  cohortProgramDefinitionsDir?: string;
  cohortDefinitionsDir?: string;
  cohortArtifactsRoot?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const evaluator = options.evaluator ?? createProgramAutomationEvaluator({
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    now: options.now
  });
  const historyStore = options.historyStore ?? createProgramAutomationHistoryStore({
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });
  const registry = options.registry ?? createCohortProgramRegistry({
    definitionsDir: options.cohortProgramDefinitionsDir
  });

  function inspectAutomationStatus(input: { cohortId: string; slot: string }) {
    return evaluator.evaluateCohortPrograms({
      cohortId: input.cohortId,
      slot: input.slot,
      execute: false,
      persistHistory: false
    }).map((entry) => entry.status);
  }

  function inspectProgramHistory(input: { cohortId: string; programId?: string }) {
    if (input.programId) {
      return historyStore.load({
        cohortId: input.cohortId,
        programId: input.programId
      });
    }

    return registry.listPrograms({ cohortId: input.cohortId })
      .map((entry) => historyStore.load({
        cohortId: input.cohortId,
        programId: entry.programId
      }))
      .sort((left, right) => left.programId.localeCompare(right.programId));
  }

  function evaluatePrograms(input: {
    cohortId?: string;
    slot: string;
  }) {
    if (input.cohortId) {
      return evaluator.evaluateCohortPrograms({
        cohortId: input.cohortId,
        slot: input.slot
      });
    }

    return evaluator.evaluateAllProgramsForSlot({
      slot: input.slot
    });
  }

  return {
    inspectAutomationStatus,
    inspectProgramHistory,
    evaluatePrograms
  };
}

export type ProgramAutomationInspection = ReturnType<typeof createProgramAutomationInspection>;
