import { createCohortRegistry, type CohortRegistry } from '../cohort-registry.ts';

import { createCohortEscalationClassifier, type CohortEscalationClassifier } from './cohort-escalation-classifier.ts';
import { createCohortEscalationHistoryStore, type CohortEscalationHistoryStore } from './cohort-escalation-history-store.ts';

export function createCohortEscalationInspection(options: {
  registry?: CohortRegistry;
  classifier?: CohortEscalationClassifier;
  historyStore?: CohortEscalationHistoryStore;
  cohortDefinitionsDir?: string;
  cohortProgramDefinitionsDir?: string;
  cohortArtifactsRoot?: string;
  investigationsRootDir?: string;
  investigationArtifactsRoot?: string;
  investigationDefinitionsDir?: string;
  signalsRootDir?: string;
  synthesisDefinitionsDir?: string;
  synthesisArtifactsRoot?: string;
  now?: () => Date;
} = {}) {
  const registry = options.registry ?? createCohortRegistry({ definitionsDir: options.cohortDefinitionsDir });
  const classifier = options.classifier ?? createCohortEscalationClassifier({
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    now: options.now
  });
  const historyStore = options.historyStore ?? createCohortEscalationHistoryStore({
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });

  function evaluateOne(input: { cohortId: string; slotOrReference?: string }) {
    const projection = classifier.classifyCohort({
      cohortId: input.cohortId,
      ...(input.slotOrReference ? { slotOrReference: input.slotOrReference } : {})
    });
    const history = historyStore.appendTransition({
      cohortId: input.cohortId,
      projection
    });
    const statusPath = historyStore.writeStatus({
      cohortId: input.cohortId,
      projection
    });

    return {
      projection,
      historyEntry: history.entry,
      historyAppended: history.appended,
      statusPath
    };
  }

  function inspectOne(input: { cohortId: string; slotOrReference?: string }) {
    return classifier.classifyCohort({
      cohortId: input.cohortId,
      ...(input.slotOrReference ? { slotOrReference: input.slotOrReference } : {})
    });
  }

  function inspectHistory(input: { cohortId: string }) {
    return historyStore.load({ cohortId: input.cohortId });
  }

  function listCurrent(input: { slotOrReference?: string } = {}) {
    return registry.listCohorts()
      .map((entry) => inspectOne({
        cohortId: entry.cohortId,
        ...(input.slotOrReference ? { slotOrReference: input.slotOrReference } : {})
      }))
      .sort((left, right) => left.cohortId.localeCompare(right.cohortId));
  }

  return {
    evaluateOne,
    inspectOne,
    inspectHistory,
    listCurrent
  };
}

export type CohortEscalationInspection = ReturnType<typeof createCohortEscalationInspection>;
