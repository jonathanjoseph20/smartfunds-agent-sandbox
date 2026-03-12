import { canonicalStringify, sha256 } from '../finance/determinism.ts';

import {
  createExecutionEngineEvaluator,
  type ExecutionEngineEvaluator,
} from './execution-engine-evaluator.ts';
import {
  createExecutionEngineHistoryStore,
  resolveExecutionEngineArtifactPaths,
  type ExecutionEngineHistoryStore,
} from './execution-engine-history-store.ts';
import type {
  ExecutionEngineRunMode,
  MissionExecutionEngineRunProjection,
} from './execution-engine-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function computeHistoryDigest(entries: unknown[]): string {
  return sha256(canonicalStringify(entries));
}

function resolveSeedByExecutionEngineRunId(input: {
  executionEngineRunId: string;
  historyStore: ExecutionEngineHistoryStore;
}): { executionAttemptId: string } | null {
  const history = input.historyStore.loadByExecutionEngineRunId({
    executionEngineRunId: input.executionEngineRunId,
  });

  if (!history || !history.executionAttemptId) {
    return null;
  }

  return {
    executionAttemptId: history.executionAttemptId,
  };
}

export function createExecutionEngineProjection(options: {
  evaluator?: ExecutionEngineEvaluator;
  historyStore?: ExecutionEngineHistoryStore;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
  executionAttemptArtifactsRoot?: string;
  executionJournalArtifactsRoot?: string;
  executionEngineArtifactsRoot?: string;
} = {}) {
  const evaluator = options.evaluator ?? createExecutionEngineEvaluator({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createExecutionEngineHistoryStore({
    artifactsRoot: options.executionEngineArtifactsRoot,
  });

  function projectOne(input: {
    executionAttemptId?: string;
    executionEngineRunId?: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }): MissionExecutionEngineRunProjection {
    let executionAttemptId = input.executionAttemptId;

    if (!executionAttemptId && input.executionEngineRunId) {
      const seed = resolveSeedByExecutionEngineRunId({
        executionEngineRunId: input.executionEngineRunId,
        historyStore,
      });

      if (seed) {
        executionAttemptId = seed.executionAttemptId;
      }
    }

    if (!executionAttemptId) {
      throw new Error('EXECUTION_ENGINE_RUN_NOT_FOUND');
    }

    const evaluated = evaluator.evaluateExecutionEngineRun({
      executionAttemptId,
      enginePolicyId: input.enginePolicyId,
      runMode: input.runMode,
      founderEngineConfirmed: input.founderEngineConfirmed,
    });

    if (input.executionEngineRunId && input.executionEngineRunId !== evaluated.executionEngineRun.executionEngineRunId) {
      throw new Error('EXECUTION_ENGINE_RUN_NOT_FOUND');
    }

    const history = historyStore.load({
      executionEngineRunId: evaluated.executionEngineRun.executionEngineRunId,
      executionAttemptId: evaluated.executionEngineRun.executionAttemptId,
      executionJournalId: evaluated.executionEngineRun.executionJournalId,
      runtimeEnvelopeId: evaluated.executionEngineRun.runtimeEnvelopeId,
      executionContractId: evaluated.executionEngineRun.executionContractId,
      missionId: evaluated.executionEngineRun.missionId,
    });

    const historyDigest = computeHistoryDigest(history.entries);
    const artifactPaths = resolveExecutionEngineArtifactPaths({
      executionEngineRunId: evaluated.executionEngineRun.executionEngineRunId,
      rootDir: options.executionEngineArtifactsRoot,
    });

    const statusPreview = {
      executionEngineRunId: evaluated.executionEngineRun.executionEngineRunId,
      executionAttemptId: evaluated.executionEngineRun.executionAttemptId,
      executionJournalId: evaluated.executionEngineRun.executionJournalId,
      runtimeEnvelopeId: evaluated.executionEngineRun.runtimeEnvelopeId,
      executionContractId: evaluated.executionEngineRun.executionContractId,
      missionId: evaluated.executionEngineRun.missionId,
      selectedTeamId: evaluated.executionEngineRun.selectedTeamId,
      enginePolicyId: evaluated.executionEngineRun.enginePolicyId,
      engineState: evaluated.executionEngineRun.engineState,
      engineEligibilityState: evaluated.executionEngineRun.engineEligibilityState,
      runMode: evaluated.executionEngineRun.runMode,
      blockingReasons: evaluated.executionEngineRun.blockingReasons,
      limitations: evaluated.executionEngineRun.limitations,
      historyDigest,
    } as Record<string, unknown>;

    const reportPreview = {
      ...evaluated.executionEngineRun,
      history,
      historyDigest,
    } as Record<string, unknown>;

    return {
      ...evaluated.executionEngineRun,
      blockingReasons: uniqueSorted(evaluated.executionEngineRun.blockingReasons),
      limitations: uniqueSorted(evaluated.executionEngineRun.limitations),
      historyDigest,
      historySummary: {
        totalEvents: history.entries.length,
        ...(history.entries[history.entries.length - 1]
          ? { lastEventType: history.entries[history.entries.length - 1].eventType }
          : {}),
        ...(history.entries[history.entries.length - 1]
          ? { lastEventDedupeKey: history.entries[history.entries.length - 1].eventDedupeKey }
          : {}),
      },
      statusPreview,
      reportPreview,
      artifactPaths,
    };
  }

  function projectAll(input: {
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  } = {}): MissionExecutionEngineRunProjection[] {
    return evaluator.evaluateAllExecutionEngineRuns(input)
      .map((entry) => projectOne({
        executionAttemptId: entry.executionEngineRun.executionAttemptId,
        enginePolicyId: input.enginePolicyId,
        runMode: input.runMode,
        founderEngineConfirmed: input.founderEngineConfirmed,
      }))
      .sort((left, right) => left.executionEngineRunId.localeCompare(right.executionEngineRunId));
  }

  function summarizeList(input: {
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  } = {}) {
    return projectAll(input)
      .map((entry) => ({
        executionEngineRunId: entry.executionEngineRunId,
        executionAttemptId: entry.executionAttemptId,
        engineState: entry.engineState,
        engineEligibilityState: entry.engineEligibilityState,
        runMode: entry.runMode,
      }))
      .sort((left, right) => left.executionEngineRunId.localeCompare(right.executionEngineRunId));
  }

  return {
    projectOne,
    projectAll,
    summarizeList,
  };
}

export type ExecutionEngineProjectionEngine = ReturnType<typeof createExecutionEngineProjection>;
