import { canonicalStringify, sha256 } from '../../finance/determinism.ts';
import { createInvestigationExecutor, type InvestigationExecutor } from '../../investigations/investigation-executor.ts';
import { createInvestigationRegistry, type InvestigationRegistry } from '../../investigations/investigation-registry.ts';
import { createInvestigationStore, type InvestigationStore } from '../../investigations/investigation-store.ts';
import { createSignalStore, type SignalStore } from '../../signals/signal-store.ts';
import { computeSignalDedupeKey } from '../../signals/signal-deduper.ts';

import { createCohortProjection, type CohortProjectionEngine } from '../cohort-projection.ts';
import { createCohortRegistry, type CohortRegistry } from '../cohort-registry.ts';

import { evaluateProgramCadence, programCadenceLaunchSlot } from './program-cadence.ts';
import { createProgramHistoryStore, type ProgramHistoryStore } from './program-history-store.ts';
import { projectProgramLifecycleState } from './program-lifecycle.ts';
import { createCohortProgramRegistry, type CohortProgramRegistry } from './program-registry.ts';
import {
  CohortProgramError,
  type CohortProgramDefinition,
  type ProgramExecutionHistoryEntry,
  type ProgramLaunchCandidate,
  type ProgramLaunchConditionKind,
  type ProgramLaunchEligibility,
  type ProgramLaunchRecord,
} from './program-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function compareConditionKind(left: ProgramLaunchConditionKind, right: ProgramLaunchConditionKind): number {
  const rank = (kind: ProgramLaunchConditionKind): number => {
    if (kind === 'cadence') return 0;
    if (kind === 'signal_type') return 1;
    return 2;
  };
  return rank(left) - rank(right);
}

function deriveLogDateFromSlot(slot: string, fallbackDate: string): string {
  const dailyMatch = /^daily:(\d{4}-\d{2}-\d{2})$/.exec(slot);
  if (dailyMatch?.[1]) {
    return dailyMatch[1];
  }

  const intervalMatch = /^(?:interval_hours|interval_minutes):\d+:(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}Z$/.exec(slot);
  if (intervalMatch?.[1]) {
    return intervalMatch[1];
  }

  const weeklyMatch = /^weekly:(\d{4}-\d{2}-\d{2})$/.exec(slot);
  if (weeklyMatch?.[1]) {
    return weeklyMatch[1];
  }

  const genericMatch = /(\d{4}-\d{2}-\d{2})/.exec(slot);
  if (genericMatch?.[1]) {
    return genericMatch[1];
  }

  return fallbackDate;
}

function subjectToken(value: string): string {
  const lowered = value.trim().toLowerCase();
  const parts = lowered.split(':');
  return parts[parts.length - 1] ?? lowered;
}

function logDateFromNow(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function computeProgramLaunchDedupeKey(input: {
  programId: string;
  cohortId: string;
  slot: string;
  conditionKind: ProgramLaunchConditionKind;
  investigationTemplate: string;
}): string {
  return sha256(canonicalStringify({
    programId: input.programId,
    cohortId: input.cohortId,
    slot: input.slot,
    conditionKind: input.conditionKind,
    investigationTemplate: input.investigationTemplate
  }));
}

export type ProgramRunProjection = {
  cohortId: string;
  programId: string;
  displayName: string;
  cadence: CohortProgramDefinition['cadence'];
  currentSlot: string;
  lifecycleState: CohortProgramDefinition['lifecycleState'];
  cohortHealthState: string;
  eligibility: ProgramLaunchEligibility;
  launches: ProgramLaunchRecord[];
  matchedConditionKinds: ProgramLaunchConditionKind[];
  linkedInvestigationTemplates: string[];
  lastExecutionSlot?: string;
  historyLength: number;
};

export function createCohortProgramLaunchEngine(options: {
  programRegistry?: CohortProgramRegistry;
  cohortRegistry?: CohortRegistry;
  cohortProjection?: CohortProjectionEngine;
  historyStore?: ProgramHistoryStore;
  investigationExecutor?: InvestigationExecutor;
  investigationRegistry?: InvestigationRegistry;
  signalStore?: SignalStore;
  investigationStore?: InvestigationStore;
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
  const programRegistry = options.programRegistry ?? createCohortProgramRegistry({
    definitionsDir: options.cohortProgramDefinitionsDir
  });
  const cohortRegistry = options.cohortRegistry ?? createCohortRegistry({ definitionsDir: options.cohortDefinitionsDir });
  const cohortProjection = options.cohortProjection ?? createCohortProjection({
    definitionsDir: options.cohortDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationDefinitionsDir: options.investigationDefinitionsDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    signalsRootDir: options.signalsRootDir,
    synthesisDefinitionsDir: options.synthesisDefinitionsDir,
    synthesisArtifactsRoot: options.synthesisArtifactsRoot,
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });
  const historyStore = options.historyStore ?? createProgramHistoryStore({
    cohortArtifactsRoot: options.cohortArtifactsRoot
  });
  const investigationRegistry = options.investigationRegistry ?? createInvestigationRegistry({
    definitionsDir: options.investigationDefinitionsDir
  });
  const signalStore = options.signalStore ?? createSignalStore({
    rootDir: options.signalsRootDir
  });
  const investigationExecutor = options.investigationExecutor ?? createInvestigationExecutor({
    definitionsDir: options.investigationDefinitionsDir,
    investigationsRootDir: options.investigationsRootDir,
    investigationArtifactsRoot: options.investigationArtifactsRoot,
    signalsRootDir: options.signalsRootDir
  });
  const investigationStore = options.investigationStore ?? createInvestigationStore({
    rootDir: options.investigationsRootDir
  });

  function conditionMatchesSignal(input: {
    cohortSubject: string;
    currentSlot: string;
    signalType: string;
  }): boolean {
    const slotDate = deriveLogDateFromSlot(input.currentSlot, '1970-01-01');

    return signalStore
      .listSignals({ signalType: input.signalType })
      .filter((entry) => entry.logDate === slotDate)
      .some((entry) => {
        const protocol = typeof entry.metadata.protocol === 'string'
          ? subjectToken(entry.metadata.protocol)
          : '';
        return protocol.length === 0 || protocol === input.cohortSubject;
      });
  }

  function evaluateEligibility(input: {
    definition: CohortProgramDefinition;
    currentSlot: string;
    cadenceDue: boolean;
    cohortHealthState: string;
    cohortSubject: string;
    lifecycleState: CohortProgramDefinition['lifecycleState'];
  }): ProgramLaunchEligibility {
    if (input.lifecycleState === 'paused' || input.lifecycleState === 'completed') {
      return {
        programId: input.definition.programId,
        cohortId: input.definition.cohortId,
        currentSlot: input.currentSlot,
        lifecycleState: input.lifecycleState,
        eligible: false,
        matchedConditionKinds: [],
        reason: 'not_eligible_lifecycle_state'
      };
    }

    const matched: ProgramLaunchConditionKind[] = [];

    for (const condition of input.definition.launchConditions) {
      if (condition.kind === 'cadence' && input.cadenceDue) {
        matched.push('cadence');
        continue;
      }

      if (condition.kind === 'signal_type' && conditionMatchesSignal({
        cohortSubject: input.cohortSubject,
        currentSlot: input.currentSlot,
        signalType: condition.signalType
      })) {
        matched.push('signal_type');
        continue;
      }

      if (condition.kind === 'cohort_health' && condition.health === input.cohortHealthState) {
        matched.push('cohort_health');
      }
    }

    const matchedConditionKinds = uniqueSorted(matched).sort(compareConditionKind);
    if (matchedConditionKinds.length === 0) {
      return {
        programId: input.definition.programId,
        cohortId: input.definition.cohortId,
        currentSlot: input.currentSlot,
        lifecycleState: input.lifecycleState,
        eligible: false,
        matchedConditionKinds,
        reason: 'no_matching_conditions'
      };
    }

    return {
      programId: input.definition.programId,
      cohortId: input.definition.cohortId,
      currentSlot: input.currentSlot,
      lifecycleState: input.lifecycleState,
      eligible: true,
      matchedConditionKinds,
      reason: 'eligible'
    };
  }

  function buildCandidates(input: {
    definition: CohortProgramDefinition;
    currentSlot: string;
    matchedConditionKinds: ProgramLaunchConditionKind[];
  }): ProgramLaunchCandidate[] {
    const preferredCondition = [...input.matchedConditionKinds].sort(compareConditionKind)[0];
    if (!preferredCondition) {
      return [];
    }

    return [...input.definition.investigationTemplates]
      .sort((left, right) => left.localeCompare(right))
      .map((investigationTemplate) => ({
        programId: input.definition.programId,
        cohortId: input.definition.cohortId,
        currentSlot: input.currentSlot,
        conditionKind: preferredCondition,
        investigationTemplate,
        launchDedupeKey: computeProgramLaunchDedupeKey({
          programId: input.definition.programId,
          cohortId: input.definition.cohortId,
          slot: input.currentSlot,
          conditionKind: preferredCondition,
          investigationTemplate
        })
      }));
  }

  function hasProgramLaunchDedupe(historyEntries: ProgramExecutionHistoryEntry[], launchDedupeKey: string): boolean {
    return historyEntries.some((entry) => entry.launches.some((launch) => launch.launchDedupeKey === launchDedupeKey));
  }

  function ensureProgramSignal(input: {
    programId: string;
    cohortId: string;
    signalType: string;
    slot: string;
    conditionKind: ProgramLaunchConditionKind;
    cohortSubject: string;
    fallbackDate: string;
  }): string {
    const dataset = `cohort_program:${input.programId}`;
    const dedupeKey = computeSignalDedupeKey({
      signalType: input.signalType,
      dataset,
      slot: input.slot
    });

    signalStore.appendSignal({
      signalType: input.signalType,
      sourceMission: 'cohort-program-monitoring',
      dataset,
      metadata: {
        programId: input.programId,
        cohortId: input.cohortId,
        launchConditionKind: input.conditionKind,
        protocol: input.cohortSubject
      },
      slot: input.slot,
      dedupeKey,
      logDate: deriveLogDateFromSlot(input.slot, input.fallbackDate)
    });

    return dedupeKey;
  }

  function launchCandidate(input: {
    candidate: ProgramLaunchCandidate;
    cohortSubject: string;
    fallbackDate: string;
    launchSlot: string;
  }): ProgramLaunchRecord {
    const definition = investigationRegistry.getInvestigation(input.candidate.investigationTemplate);
    if (!definition.sourceSignalType || !definition.sourceTriggerId) {
      return {
        launchDedupeKey: input.candidate.launchDedupeKey,
        conditionKind: input.candidate.conditionKind,
        investigationTemplate: input.candidate.investigationTemplate,
        sourceSignalType: definition.sourceSignalType ?? 'n/a',
        sourceSignalDedupeKey: 'n/a',
        status: 'skipped',
        note: 'investigation_template_missing_source_trigger_or_signal_type'
      };
    }

    const sourceSignalDedupeKey = ensureProgramSignal({
      programId: input.candidate.programId,
      cohortId: input.candidate.cohortId,
      signalType: definition.sourceSignalType,
      slot: input.launchSlot,
      conditionKind: input.candidate.conditionKind,
      cohortSubject: input.cohortSubject,
      fallbackDate: input.fallbackDate
    });

    const launch = investigationExecutor.executeLaunchRequest({
      missionId: `cohort-program:${input.candidate.programId}`,
      triggerId: definition.sourceTriggerId,
      sourceSignal: sourceSignalDedupeKey
    });

    return {
      launchDedupeKey: input.candidate.launchDedupeKey,
      conditionKind: input.candidate.conditionKind,
      investigationTemplate: input.candidate.investigationTemplate,
      sourceSignalType: definition.sourceSignalType,
      sourceSignalDedupeKey,
      status: launch.status,
      ...(launch.record?.investigationRunId ? { investigationRunId: launch.record.investigationRunId } : {})
    };
  }

  function runProgram(input: { programId: string; slot?: string }): ProgramRunProjection {
    const definition = programRegistry.getProgram(input.programId);
    const cohortDefinition = cohortRegistry.getCohortDefinition(definition.cohortId);
    const cohortSubject = subjectToken(cohortDefinition.subjectKey);

    const history = historyStore.load({ cohortId: definition.cohortId, programId: definition.programId });
    const cohort = cohortProjection.projectOne(definition.cohortId).cohort;
    const lifecycleState = projectProgramLifecycleState({
      definition,
      historyEntries: history.entries
    });

    const cadence = evaluateProgramCadence({
      program: definition,
      historyEntries: history.entries,
      now: now(),
      ...(input.slot ? { explicitSlot: input.slot } : {})
    });

    const eligibility = evaluateEligibility({
      definition,
      currentSlot: cadence.currentSlot,
      cadenceDue: cadence.cadenceDue,
      cohortHealthState: cohort.healthState,
      cohortSubject,
      lifecycleState
    });

    const launches: ProgramLaunchRecord[] = [];

    if (eligibility.eligible) {
      const candidates = buildCandidates({
        definition,
        currentSlot: cadence.currentSlot,
        matchedConditionKinds: eligibility.matchedConditionKinds
      });

      const fallbackDate = logDateFromNow(now());
      const launchSlot = programCadenceLaunchSlot({
        cadence: definition.cadence,
        cadenceSlot: cadence.currentSlot
      });

      for (const candidate of candidates) {
        if (hasProgramLaunchDedupe(history.entries, candidate.launchDedupeKey)) {
          const investigation = investigationStore.listInvestigations()
            .find((entry) => entry.investigationDefinitionId === candidate.investigationTemplate && entry.slot === launchSlot);

          launches.push({
            launchDedupeKey: candidate.launchDedupeKey,
            conditionKind: candidate.conditionKind,
            investigationTemplate: candidate.investigationTemplate,
            sourceSignalType: 'n/a',
            sourceSignalDedupeKey: 'n/a',
            status: 'skipped',
            note: 'program_launch_deduped_for_slot',
            ...(investigation ? { investigationRunId: investigation.investigationRunId } : {})
          });
          continue;
        }

        launches.push(launchCandidate({
          candidate,
          cohortSubject,
          fallbackDate,
          launchSlot
        }));
      }
    }

    const historyEntry: ProgramExecutionHistoryEntry = {
      evaluatedSlot: cadence.currentSlot,
      logDate: deriveLogDateFromSlot(cadence.currentSlot, logDateFromNow(now())),
      lifecycleState,
      matchedConditionKinds: eligibility.matchedConditionKinds,
      launches: [...launches].sort((left, right) => left.launchDedupeKey.localeCompare(right.launchDedupeKey))
    };

    const nextHistory = historyStore.append({
      cohortId: definition.cohortId,
      programId: definition.programId,
      entry: historyEntry
    });

    const updatedLifecycleState = projectProgramLifecycleState({
      definition,
      historyEntries: nextHistory.entries
    });

    return {
      cohortId: definition.cohortId,
      programId: definition.programId,
      displayName: definition.displayName,
      cadence: definition.cadence,
      currentSlot: cadence.currentSlot,
      lifecycleState: updatedLifecycleState,
      cohortHealthState: cohort.healthState,
      eligibility,
      launches,
      matchedConditionKinds: eligibility.matchedConditionKinds,
      linkedInvestigationTemplates: [...definition.investigationTemplates].sort((left, right) => left.localeCompare(right)),
      ...(nextHistory.entries[0]?.evaluatedSlot ? { lastExecutionSlot: nextHistory.entries[0].evaluatedSlot } : {}),
      historyLength: nextHistory.entries.length
    };
  }

  return {
    runProgram
  };
}

export type CohortProgramLaunchEngine = ReturnType<typeof createCohortProgramLaunchEngine>;
