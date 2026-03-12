import {
  createExecutionJournalHistoryStore,
  type ExecutionJournalHistoryStore,
} from '../execution-journal/execution-journal-history-store.ts';

import { createExecutionEngineEvaluator, type ExecutionEngineEvaluator } from './execution-engine-evaluator.ts';
import {
  createExecutionEngineHistoryStore,
  type ExecutionEngineHistoryStore,
} from './execution-engine-history-store.ts';
import type { ExecutionEngineRunMode } from './execution-engine-types.ts';

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  initialized: ['eligible_to_start'],
  eligible_to_start: ['started'],
  started: ['running'],
  running: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
  archived: [],
};

function assertTransition(input: { from: string; to: string }): void {
  const allowed = ALLOWED_TRANSITIONS[input.from] ?? [];
  if (!allowed.includes(input.to)) {
    throw new Error(`EXECUTION_ENGINE_INVALID_TRANSITION: ${input.from} -> ${input.to}`);
  }
}

function ensureReason(reason: string | undefined, code: string): string {
  const normalized = reason?.trim();
  if (!normalized) {
    throw new Error(code);
  }
  return normalized;
}

export function createExecutionEngineRunner(options: {
  evaluator?: ExecutionEngineEvaluator;
  historyStore?: ExecutionEngineHistoryStore;
  journalHistoryStore?: ExecutionJournalHistoryStore;
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

  const journalHistoryStore = options.journalHistoryStore ?? createExecutionJournalHistoryStore({
    artifactsRoot: options.executionJournalArtifactsRoot,
  });

  function appendEngineHistoryBase(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    const evaluated = evaluator.evaluateExecutionEngineRun(input);
    const run = evaluated.executionEngineRun;

    historyStore.append({
      executionEngineRunId: run.executionEngineRunId,
      executionAttemptId: run.executionAttemptId,
      executionJournalId: run.executionJournalId,
      runtimeEnvelopeId: run.runtimeEnvelopeId,
      executionContractId: run.executionContractId,
      missionId: run.missionId,
      eventType: 'engine_run_initialized',
      reasoning: 'execution_engine_run_initialized',
      payload: {
        executionEngineRunId: run.executionEngineRunId,
        executionAttemptId: run.executionAttemptId,
        engineState: run.engineState,
        engineEligibilityState: run.engineEligibilityState,
        runMode: run.runMode,
      },
    });

    if (run.engineEligibilityState === 'eligible') {
      historyStore.append({
        executionEngineRunId: run.executionEngineRunId,
        executionAttemptId: run.executionAttemptId,
        executionJournalId: run.executionJournalId,
        runtimeEnvelopeId: run.runtimeEnvelopeId,
        executionContractId: run.executionContractId,
        missionId: run.missionId,
        eventType: 'engine_run_eligible',
        reasoning: 'execution_engine_run_eligible',
        payload: {
          executionEngineRunId: run.executionEngineRunId,
          executionAttemptId: run.executionAttemptId,
          engineEligibilityState: run.engineEligibilityState,
          blockingReasons: run.blockingReasons,
        },
      });
    }

    return evaluator.evaluateExecutionEngineRun(input).executionEngineRun;
  }

  function startRun(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    const run = appendEngineHistoryBase(input);

    if (run.engineEligibilityState !== 'eligible') {
      throw new Error('EXECUTION_ENGINE_INVALID_TRANSITION: initialized -> started');
    }

    assertTransition({ from: run.engineState, to: 'started' });
    assertTransition({ from: 'started', to: 'running' });

    historyStore.append({
      executionEngineRunId: run.executionEngineRunId,
      executionAttemptId: run.executionAttemptId,
      executionJournalId: run.executionJournalId,
      runtimeEnvelopeId: run.runtimeEnvelopeId,
      executionContractId: run.executionContractId,
      missionId: run.missionId,
      eventType: 'engine_run_started',
      reasoning: 'execution_engine_run_started',
      payload: {
        executionEngineRunId: run.executionEngineRunId,
        executionAttemptId: run.executionAttemptId,
        previousEngineState: run.engineState,
        nextEngineState: 'running',
        runMode: run.runMode,
      },
    });

    journalHistoryStore.append({
      executionJournalId: run.executionJournalId,
      executionAttemptId: run.executionAttemptId,
      runtimeEnvelopeId: run.runtimeEnvelopeId,
      executionContractId: run.executionContractId,
      missionId: run.missionId,
      eventType: 'execution_started',
      eventPayload: {
        executionEngineRunId: run.executionEngineRunId,
        executionAttemptId: run.executionAttemptId,
        runMode: run.runMode,
        enginePolicyId: run.enginePolicyId,
      },
      reasonTokens: ['execution_engine_started'],
      blockingReasons: run.blockingReasons,
      limitations: run.limitations,
    });

    return evaluator.evaluateExecutionEngineRun(input).executionEngineRun;
  }

  function completeRun(input: {
    executionAttemptId: string;
    completionReason?: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    const run = evaluator.evaluateExecutionEngineRun(input).executionEngineRun;
    assertTransition({ from: run.engineState, to: 'completed' });

    historyStore.append({
      executionEngineRunId: run.executionEngineRunId,
      executionAttemptId: run.executionAttemptId,
      executionJournalId: run.executionJournalId,
      runtimeEnvelopeId: run.runtimeEnvelopeId,
      executionContractId: run.executionContractId,
      missionId: run.missionId,
      eventType: 'engine_run_completed',
      reasoning: 'execution_engine_run_completed',
      payload: {
        executionEngineRunId: run.executionEngineRunId,
        executionAttemptId: run.executionAttemptId,
        completionReason: input.completionReason?.trim() || 'execution_engine_completed_explicitly',
      },
    });

    journalHistoryStore.append({
      executionJournalId: run.executionJournalId,
      executionAttemptId: run.executionAttemptId,
      runtimeEnvelopeId: run.runtimeEnvelopeId,
      executionContractId: run.executionContractId,
      missionId: run.missionId,
      eventType: 'execution_completed',
      eventPayload: {
        executionEngineRunId: run.executionEngineRunId,
        executionAttemptId: run.executionAttemptId,
        completionReason: input.completionReason?.trim() || 'execution_engine_completed_explicitly',
      },
      reasonTokens: ['execution_engine_completed'],
      blockingReasons: run.blockingReasons,
      limitations: run.limitations,
    });

    return evaluator.evaluateExecutionEngineRun(input).executionEngineRun;
  }

  function failRun(input: {
    executionAttemptId: string;
    failureReason: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    const run = evaluator.evaluateExecutionEngineRun(input).executionEngineRun;
    assertTransition({ from: run.engineState, to: 'failed' });

    const failureReason = ensureReason(input.failureReason, 'EXECUTION_ENGINE_REASON_REQUIRED');

    historyStore.append({
      executionEngineRunId: run.executionEngineRunId,
      executionAttemptId: run.executionAttemptId,
      executionJournalId: run.executionJournalId,
      runtimeEnvelopeId: run.runtimeEnvelopeId,
      executionContractId: run.executionContractId,
      missionId: run.missionId,
      eventType: 'engine_run_failed',
      reasoning: 'execution_engine_run_failed',
      payload: {
        executionEngineRunId: run.executionEngineRunId,
        executionAttemptId: run.executionAttemptId,
        failureReason,
      },
    });

    journalHistoryStore.append({
      executionJournalId: run.executionJournalId,
      executionAttemptId: run.executionAttemptId,
      runtimeEnvelopeId: run.runtimeEnvelopeId,
      executionContractId: run.executionContractId,
      missionId: run.missionId,
      eventType: 'execution_failed',
      eventPayload: {
        executionEngineRunId: run.executionEngineRunId,
        executionAttemptId: run.executionAttemptId,
        failureReason,
      },
      reasonTokens: ['execution_engine_failed'],
      blockingReasons: run.blockingReasons,
      limitations: run.limitations,
    });

    return evaluator.evaluateExecutionEngineRun(input).executionEngineRun;
  }

  function cancelRun(input: {
    executionAttemptId: string;
    cancellationReason: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }) {
    const run = evaluator.evaluateExecutionEngineRun(input).executionEngineRun;
    assertTransition({ from: run.engineState, to: 'cancelled' });

    const cancellationReason = ensureReason(input.cancellationReason, 'EXECUTION_ENGINE_REASON_REQUIRED');

    historyStore.append({
      executionEngineRunId: run.executionEngineRunId,
      executionAttemptId: run.executionAttemptId,
      executionJournalId: run.executionJournalId,
      runtimeEnvelopeId: run.runtimeEnvelopeId,
      executionContractId: run.executionContractId,
      missionId: run.missionId,
      eventType: 'engine_run_cancelled',
      reasoning: 'execution_engine_run_cancelled',
      payload: {
        executionEngineRunId: run.executionEngineRunId,
        executionAttemptId: run.executionAttemptId,
        cancellationReason,
      },
    });

    journalHistoryStore.append({
      executionJournalId: run.executionJournalId,
      executionAttemptId: run.executionAttemptId,
      runtimeEnvelopeId: run.runtimeEnvelopeId,
      executionContractId: run.executionContractId,
      missionId: run.missionId,
      eventType: 'execution_cancelled',
      eventPayload: {
        executionEngineRunId: run.executionEngineRunId,
        executionAttemptId: run.executionAttemptId,
        cancellationReason,
      },
      reasonTokens: ['execution_engine_cancelled'],
      blockingReasons: run.blockingReasons,
      limitations: run.limitations,
    });

    return evaluator.evaluateExecutionEngineRun(input).executionEngineRun;
  }

  return {
    startRun,
    completeRun,
    failRun,
    cancelRun,
  };
}

export type ExecutionEngineRunner = ReturnType<typeof createExecutionEngineRunner>;
