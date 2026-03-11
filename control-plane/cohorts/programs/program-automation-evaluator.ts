import { createSignalStore, type SignalStore } from '../../signals/signal-store.ts';

import { createCohortEscalationInspection, type CohortEscalationInspection } from '../escalation/cohort-escalation-inspection.ts';
import { createCohortProjection, type CohortProjectionEngine } from '../cohort-projection.ts';

import { evaluateProgramCadence } from './program-cadence.ts';
import { createProgramAutomationHistoryStore, type ProgramAutomationHistoryStore } from './program-automation-history-store.ts';
import type { ProgramAutomationEvaluationResult, ProgramAutomationStatus } from './program-automation-types.ts';
import { createProgramHistoryStore, type ProgramHistoryStore } from './program-history-store.ts';
import { createCohortProgramLaunchEngine, type CohortProgramLaunchEngine } from './program-launch.ts';
import { projectProgramLifecycleState } from './program-lifecycle.ts';
import { createCohortProgramRegistry, type CohortProgramRegistry } from './program-registry.ts';
import type { CohortProgramDefinition, ProgramLaunchConditionKind } from './program-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function parseDateFromSlot(slot: string, fallbackDate: string): string {
  const match = /(\d{4}-\d{2}-\d{2})/.exec(slot);
  return match?.[1] ?? fallbackDate;
}

function subjectToken(value: string): string {
  const lowered = value.trim().toLowerCase();
  const parts = lowered.split(':');
  return parts[parts.length - 1] ?? lowered;
}

function compareConditionKind(left: ProgramLaunchConditionKind, right: ProgramLaunchConditionKind): number {
  const rank = (kind: ProgramLaunchConditionKind): number => {
    if (kind === 'cadence') return 0;
    if (kind === 'signal_type') return 1;
    if (kind === 'cohort_health') return 2;
    return 3;
  };

  return rank(left) - rank(right);
}

function dominantEvaluationState(kinds: ProgramLaunchConditionKind[], eligibleLifecycle: boolean): ProgramAutomationStatus['evaluationState'] {
  if (!eligibleLifecycle) {
    return 'suppressed';
  }

  if (kinds.includes('cadence')) {
    return 'due';
  }
  if (kinds.includes('signal_type')) {
    return 'signal_match';
  }
  if (kinds.includes('cohort_health')) {
    return 'health_match';
  }
  if (kinds.includes('cohort_escalation')) {
    return 'escalation_match';
  }
  return 'not_due';
}

export function createProgramAutomationEvaluator(options: {
  registry?: CohortProgramRegistry;
  launcher?: CohortProgramLaunchEngine;
  cohortProjection?: CohortProjectionEngine;
  signalStore?: SignalStore;
  historyStore?: ProgramAutomationHistoryStore;
  programHistoryStore?: ProgramHistoryStore;
  escalationInspection?: CohortEscalationInspection;
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
  const launcher = options.launcher ?? createCohortProgramLaunchEngine({
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    now
  });
  const cohortProjection = options.cohortProjection ?? createCohortProjection({
    definitionsDir: options.cohortDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });
  const signalStore = options.signalStore ?? createSignalStore({ rootDir: options.signalsRootDir });
  const historyStore = options.historyStore ?? createProgramAutomationHistoryStore({ cohortArtifactsRoot: options.cohortArtifactsRoot });
  const programHistoryStore = options.programHistoryStore ?? createProgramHistoryStore({ cohortArtifactsRoot: options.cohortArtifactsRoot });
  const escalationInspection = options.escalationInspection ?? createCohortEscalationInspection({
    cohortDefinitionsDir: options.cohortDefinitionsDir,
    cohortProgramDefinitionsDir: options.cohortProgramDefinitionsDir,
    cohortArtifactsRoot: options.cohortArtifactsRoot,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    now
  });

  function evaluateDefinition(input: {
    definition: CohortProgramDefinition;
    slot: string;
    persistEscalation: boolean;
  }): {
    status: ProgramAutomationStatus;
    matchedKinds: ProgramLaunchConditionKind[];
  } {
    const history = programHistoryStore.load({
      cohortId: input.definition.cohortId,
      programId: input.definition.programId
    });
    const projected = cohortProjection.projectOne(input.definition.cohortId).cohort;
    const lifecycleState = projectProgramLifecycleState({
      definition: input.definition,
      historyEntries: history.entries
    });

    const cadence = evaluateProgramCadence({
      program: input.definition,
      historyEntries: history.entries,
      now: now(),
      explicitSlot: input.slot
    });

    const escalation = input.persistEscalation
      ? escalationInspection.evaluateOne({ cohortId: input.definition.cohortId, slotOrReference: input.slot }).projection
      : escalationInspection.inspectOne({ cohortId: input.definition.cohortId, slotOrReference: input.slot });

    const fallbackDate = now().toISOString().slice(0, 10);
    const slotDate = parseDateFromSlot(input.slot, fallbackDate);
    const cohortSubject = subjectToken(projected.subjectKey);

    const matchedKinds: ProgramLaunchConditionKind[] = [];
    const triggerReasons: string[] = [];
    const signalReferences: string[] = [];

    for (const condition of input.definition.launchConditions) {
      if (condition.kind === 'cadence' && cadence.cadenceDue) {
        matchedKinds.push('cadence');
        triggerReasons.push('cadence_due');
      }

      if (condition.kind === 'signal_type') {
        const matches = signalStore.listSignals({ signalType: condition.signalType })
          .filter((entry) => entry.logDate === slotDate)
          .filter((entry) => {
            const protocol = typeof entry.metadata.protocol === 'string'
              ? subjectToken(entry.metadata.protocol)
              : '';
            return protocol.length === 0 || protocol === cohortSubject;
          })
          .sort((left, right) => left.dedupeKey.localeCompare(right.dedupeKey));

        if (matches.length > 0) {
          matchedKinds.push('signal_type');
          triggerReasons.push(`signal_match:${condition.signalType}`);
          signalReferences.push(...matches.map((entry) => entry.dedupeKey));
        }
      }

      if (condition.kind === 'cohort_health' && condition.health === projected.healthState) {
        matchedKinds.push('cohort_health');
        triggerReasons.push(`cohort_health_match:${condition.health}`);
      }

      if (condition.kind === 'cohort_escalation' && condition.escalationState === escalation.escalationState) {
        matchedKinds.push('cohort_escalation');
        triggerReasons.push(`cohort_escalation_match:${condition.escalationState}`);
      }
    }

    const sortedKinds = uniqueSorted(matchedKinds).sort(compareConditionKind);
    const eligibleLifecycle = lifecycleState !== 'paused' && lifecycleState !== 'completed';

    return {
      status: {
        programId: input.definition.programId,
        cohortId: input.definition.cohortId,
        evaluationState: dominantEvaluationState(sortedKinds, eligibleLifecycle),
        triggerReasons: uniqueSorted(triggerReasons),
        triggeringConditionTypes: sortedKinds,
        ...(history.entries[0]?.evaluatedSlot ? { lastRunSlot: history.entries[0].evaluatedSlot } : {}),
        ...(signalReferences.length > 0 ? { lastSignalReferences: uniqueSorted(signalReferences) } : {}),
        currentEscalationState: escalation.escalationState
      },
      matchedKinds: sortedKinds
    };
  }

  function evaluateProgram(input: {
    programId: string;
    slot: string;
    execute?: boolean;
    persistHistory?: boolean;
  }): ProgramAutomationEvaluationResult {
    const definition = registry.getProgram(input.programId);
    const evaluation = evaluateDefinition({
      definition,
      slot: input.slot,
      persistEscalation: input.persistHistory !== false
    });

    const execute = input.execute !== false;
    const persistHistory = input.persistHistory !== false;
    const baseStatus = evaluation.status;

    const priorAutomation = historyStore.load({
      cohortId: definition.cohortId,
      programId: definition.programId
    });

    const alreadyProcessed = priorAutomation.entries.find((entry) => entry.slotOrSignalRef === input.slot);

    if (alreadyProcessed) {
      const dedupedStatus: ProgramAutomationStatus = {
        ...baseStatus,
        evaluationState: 'deduped',
        launchedInvestigationIds: [...alreadyProcessed.launchedInvestigationIds],
        dedupeKey: alreadyProcessed.dedupeKey,
        ...(alreadyProcessed.launchDedupeResult ? { launchDedupeResult: alreadyProcessed.launchDedupeResult } : {})
      };

      if (!persistHistory) {
        return {
          status: dedupedStatus,
          historyAppended: false
        };
      }

      const dedupeWrite = historyStore.append({
        cohortId: definition.cohortId,
        programId: definition.programId,
        entry: {
          programId: definition.programId,
          cohortId: definition.cohortId,
          slotOrSignalRef: input.slot,
          evaluationOutcome: 'deduped',
          launched: alreadyProcessed.launched,
          launchedInvestigationIds: [...alreadyProcessed.launchedInvestigationIds],
          triggerReason: [...baseStatus.triggerReasons],
          triggeringConditionTypes: [...baseStatus.triggeringConditionTypes],
          ...(alreadyProcessed.launchDedupeResult ? { launchDedupeResult: alreadyProcessed.launchDedupeResult } : {})
        }
      });

      historyStore.writeStatus({
        cohortId: definition.cohortId,
        programId: definition.programId,
        status: dedupedStatus
      });

      return {
        status: {
          ...dedupedStatus,
          dedupeKey: dedupeWrite.entry.dedupeKey
        },
        historyAppended: dedupeWrite.appended
      };
    }

    let nextStatus: ProgramAutomationStatus = {
      ...baseStatus
    };

    if (execute && baseStatus.evaluationState !== 'not_due' && baseStatus.evaluationState !== 'suppressed') {
      const run = launcher.runProgram({ programId: input.programId, slot: input.slot });
      const launchedInvestigationIds = uniqueSorted(run.launches
        .map((entry) => entry.investigationRunId)
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0));
      const launchDedupeResult = uniqueSorted(run.launches
        .map((entry) => entry.note)
        .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0))
        .join(',');
      const anyStarted = run.launches.some((entry) => entry.status === 'started');

      nextStatus = {
        ...baseStatus,
        evaluationState: anyStarted ? 'launched' : 'suppressed',
        ...(launchedInvestigationIds.length > 0 ? { launchedInvestigationIds } : {}),
        ...(launchDedupeResult.length > 0 ? { launchDedupeResult } : {})
      };
    }

    if (!persistHistory) {
      return {
        status: nextStatus,
        historyAppended: false
      };
    }

    const historyWrite = historyStore.append({
      cohortId: definition.cohortId,
      programId: definition.programId,
      entry: {
        programId: definition.programId,
        cohortId: definition.cohortId,
        slotOrSignalRef: input.slot,
        evaluationOutcome: nextStatus.evaluationState,
        launched: nextStatus.evaluationState === 'launched',
        launchedInvestigationIds: [...(nextStatus.launchedInvestigationIds ?? [])],
        triggerReason: [...nextStatus.triggerReasons],
        triggeringConditionTypes: [...nextStatus.triggeringConditionTypes],
        ...(nextStatus.launchDedupeResult ? { launchDedupeResult: nextStatus.launchDedupeResult } : {})
      }
    });

    const statusWithDedupe: ProgramAutomationStatus = {
      ...nextStatus,
      dedupeKey: historyWrite.entry.dedupeKey
    };

    historyStore.writeStatus({
      cohortId: definition.cohortId,
      programId: definition.programId,
      status: statusWithDedupe
    });

    return {
      status: statusWithDedupe,
      historyAppended: historyWrite.appended
    };
  }

  function evaluateCohortPrograms(input: {
    cohortId: string;
    slot: string;
    execute?: boolean;
    persistHistory?: boolean;
  }): ProgramAutomationEvaluationResult[] {
    return registry.listPrograms({ cohortId: input.cohortId })
      .map((definition) => evaluateProgram({
        programId: definition.programId,
        slot: input.slot,
        ...(input.execute === false ? { execute: false } : {}),
        ...(input.persistHistory === false ? { persistHistory: false } : {})
      }))
      .sort((left, right) => left.status.programId.localeCompare(right.status.programId));
  }

  function evaluateAllProgramsForSlot(input: {
    slot: string;
    execute?: boolean;
    persistHistory?: boolean;
  }): ProgramAutomationEvaluationResult[] {
    return registry.listPrograms()
      .map((definition) => evaluateProgram({
        programId: definition.programId,
        slot: input.slot,
        ...(input.execute === false ? { execute: false } : {}),
        ...(input.persistHistory === false ? { persistHistory: false } : {})
      }))
      .sort((left, right) => {
        const cohortCmp = left.status.cohortId.localeCompare(right.status.cohortId);
        if (cohortCmp !== 0) {
          return cohortCmp;
        }
        return left.status.programId.localeCompare(right.status.programId);
      });
  }

  return {
    evaluateProgram,
    evaluateCohortPrograms,
    evaluateAllProgramsForSlot
  };
}

export type ProgramAutomationEvaluator = ReturnType<typeof createProgramAutomationEvaluator>;
