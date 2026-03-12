import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  createExecutionAttemptProjection,
  type ExecutionAttemptProjectionEngine,
} from '../execution-attempt/execution-attempt-projection.ts';
import {
  createExecutionContractProjection,
  type ExecutionContractProjectionEngine,
} from '../execution-contract/execution-contract-projection.ts';
import {
  createExecutionJournalProjection,
  type ExecutionJournalProjectionEngine,
} from '../execution-journal/execution-journal-projection.ts';
import {
  createRuntimeEnvelopeProjection,
  type RuntimeEnvelopeProjectionEngine,
} from '../runtime-envelope/runtime-envelope-projection.ts';

import {
  DEFAULT_EXECUTION_ENGINE_POLICY_ID,
  getExecutionEnginePolicy,
} from './execution-engine-policies.ts';
import { createExecutionEngineHistoryStore, type ExecutionEngineHistoryStore } from './execution-engine-history-store.ts';
import type { ExecutionEnginePolicy } from './execution-engine-policy-types.ts';
import { deriveExecutionEngineStatus } from './execution-engine-status.ts';
import type {
  ExecutionEngineRunInputs,
  ExecutionEngineRunMode,
  ExecutionEngineRunOutputs,
  MissionExecutionEngineHistoryEntry,
  MissionExecutionEngineRun,
} from './execution-engine-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeStringRecord(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values)
    .map(([key, value]) => [key, String(value)])
    .sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeBooleanRecord(values: Record<string, boolean>): Record<string, boolean> {
  return Object.fromEntries(Object.entries(values)
    .map(([key, value]) => [key, Boolean(value)])
    .sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeUnknownRecord(values: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(canonicalStringify(values)) as Record<string, unknown>;
}

function normalizeRunInputs(inputs: ExecutionEngineRunInputs): ExecutionEngineRunInputs {
  return {
    normalizedRuntimePayload: normalizeUnknownRecord(inputs.normalizedRuntimePayload),
    executionTarget: inputs.executionTarget,
    allowedActions: uniqueSorted(inputs.allowedActions),
    prohibitedActions: uniqueSorted(inputs.prohibitedActions),
    capabilityFlags: normalizeBooleanRecord(inputs.capabilityFlags),
    engineMetadata: normalizeStringRecord(inputs.engineMetadata),
  };
}

function deriveExecutionEngineRunId(input: {
  executionAttemptId: string;
  executionJournalId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  enginePolicyId: string;
  runMode: ExecutionEngineRunMode;
  runInputs: ExecutionEngineRunInputs;
}): string {
  return sha256(canonicalStringify({
    executionAttemptId: input.executionAttemptId,
    executionJournalId: input.executionJournalId,
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    executionContractId: input.executionContractId,
    enginePolicyId: input.enginePolicyId,
    runMode: input.runMode,
    normalizedRunInputs: normalizeRunInputs(input.runInputs),
  }));
}

function computeHistoryDigest(entries: MissionExecutionEngineHistoryEntry[]): string {
  return sha256(canonicalStringify(entries));
}

function findPayloadReason(entries: MissionExecutionEngineHistoryEntry[], eventType: string, key: string): string | undefined {
  const entry = entries.find((row) => row.eventType === eventType);
  if (!entry) {
    return undefined;
  }

  const value = entry.payload[key];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function deriveRunOutputs(input: {
  engineState: string;
  historyEntries: MissionExecutionEngineHistoryEntry[];
}): ExecutionEngineRunOutputs {
  if (input.engineState === 'completed') {
    return {
      outputState: 'completed',
      resultSummary: 'execution_engine_completed',
      generatedArtifacts: ['execution-engine-status.json', 'execution-engine-report.json', 'execution-engine-history.json', 'execution-engine-outputs.json'],
      completionReason: findPayloadReason(input.historyEntries, 'engine_run_completed', 'completionReason') ?? 'execution_engine_completion_noted',
    };
  }

  if (input.engineState === 'failed') {
    return {
      outputState: 'failed',
      resultSummary: 'execution_engine_failed',
      generatedArtifacts: [],
      failureReason: findPayloadReason(input.historyEntries, 'engine_run_failed', 'failureReason') ?? 'execution_engine_failure_noted',
    };
  }

  if (input.engineState === 'cancelled') {
    return {
      outputState: 'cancelled',
      resultSummary: 'execution_engine_cancelled',
      generatedArtifacts: [],
      failureReason: findPayloadReason(input.historyEntries, 'engine_run_cancelled', 'cancellationReason') ?? 'execution_engine_cancellation_noted',
    };
  }

  if (input.engineState === 'running' || input.engineState === 'started') {
    return {
      outputState: 'running',
      resultSummary: 'execution_engine_running',
      generatedArtifacts: [],
    };
  }

  return {
    outputState: 'not_started',
    resultSummary: 'execution_engine_not_started',
    generatedArtifacts: [],
  };
}

function resolveRunMode(input: {
  policy: ExecutionEnginePolicy;
  runMode?: ExecutionEngineRunMode;
}): ExecutionEngineRunMode {
  const runMode = input.runMode ?? input.policy.defaultRunMode;

  if (runMode === 'simulation_only' && !input.policy.allowsSimulationOnly) {
    throw new Error('EXECUTION_ENGINE_POLICY_REJECTS_SIMULATION_MODE');
  }

  if (runMode === 'bounded_local_execution' && !input.policy.allowsLiveExecution) {
    throw new Error('EXECUTION_ENGINE_POLICY_REJECTS_LIVE_EXECUTION_MODE');
  }

  return runMode;
}

function isCapabilityModelCompatible(input: {
  runMode: ExecutionEngineRunMode;
  policy: ExecutionEnginePolicy;
}): boolean {
  if (input.runMode === 'bounded_local_execution' && !input.policy.allowsLiveExecution) {
    return false;
  }

  if (input.runMode === 'simulation_only' && !input.policy.allowsSimulationOnly) {
    return false;
  }

  return true;
}

export interface ExecutionEngineEvaluationResult {
  executionEngineRun: MissionExecutionEngineRun;
  policy: ExecutionEnginePolicy;
}

export function createExecutionEngineEvaluator(options: {
  executionAttemptProjection?: ExecutionAttemptProjectionEngine;
  executionJournalProjection?: ExecutionJournalProjectionEngine;
  runtimeEnvelopeProjection?: RuntimeEnvelopeProjectionEngine;
  executionContractProjection?: ExecutionContractProjectionEngine;
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
  const executionAttemptProjection = options.executionAttemptProjection ?? createExecutionAttemptProjection({
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
  });

  const executionJournalProjection = options.executionJournalProjection ?? createExecutionJournalProjection({
    executionAttemptProjection,
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
  });

  const runtimeEnvelopeProjection = options.runtimeEnvelopeProjection ?? createRuntimeEnvelopeProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
  });

  const executionContractProjection = options.executionContractProjection ?? createExecutionContractProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createExecutionEngineHistoryStore({
    artifactsRoot: options.executionEngineArtifactsRoot,
  });

  function evaluateExecutionEngineRun(input: {
    executionAttemptId: string;
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  }): ExecutionEngineEvaluationResult {
    const policy = getExecutionEnginePolicy(input.enginePolicyId ?? DEFAULT_EXECUTION_ENGINE_POLICY_ID);
    if (!policy.enabled) {
      throw new Error('EXECUTION_ENGINE_POLICY_DISABLED');
    }

    const attempt = executionAttemptProjection.projectOne({ executionAttemptId: input.executionAttemptId });
    const journal = executionJournalProjection.projectOne({ executionAttemptId: input.executionAttemptId });
    const runtimeEnvelope = runtimeEnvelopeProjection.projectOne({ runtimeEnvelopeId: attempt.runtimeEnvelopeId });
    const contract = executionContractProjection.projectOne({
      missionId: attempt.missionId,
      executionPolicyId: attempt.executionPolicyId,
    });

    const runMode = resolveRunMode({ policy, runMode: input.runMode });
    const capabilityModelCompatible = isCapabilityModelCompatible({ runMode, policy });

    const runInputs = normalizeRunInputs({
      normalizedRuntimePayload: runtimeEnvelope.runtimePayload as Record<string, unknown>,
      executionTarget: runtimeEnvelope.executionTarget,
      allowedActions: contract.authorizedActions,
      prohibitedActions: contract.prohibitedActions,
      capabilityFlags: {
        supportsTaskGraph: runtimeEnvelope.runtimeCapabilities.supportsTaskGraph,
        supportsRetries: runtimeEnvelope.runtimeCapabilities.supportsRetries,
        supportsResourceBinding: runtimeEnvelope.runtimeCapabilities.supportsResourceBinding,
        supportsExternalAPIs: runtimeEnvelope.runtimeCapabilities.supportsExternalAPIs,
        supportsParallelExecution: runtimeEnvelope.runtimeCapabilities.supportsParallelExecution,
        supportsAgentInvocation: runtimeEnvelope.runtimeCapabilities.supportsAgentInvocation,
      },
      engineMetadata: {
        executionPolicyId: contract.executionPolicyId,
        runtimeEnvelopePolicy: 'derived_from_runtime_envelope_projection',
        enginePolicyId: policy.enginePolicyId,
        runMode,
      },
    });

    const executionEngineRunId = deriveExecutionEngineRunId({
      executionAttemptId: attempt.executionAttemptId,
      executionJournalId: journal.executionJournalId,
      runtimeEnvelopeId: attempt.runtimeEnvelopeId,
      executionContractId: attempt.executionContractId,
      enginePolicyId: policy.enginePolicyId,
      runMode,
      runInputs,
    });

    const history = historyStore.load({
      executionEngineRunId,
      executionAttemptId: attempt.executionAttemptId,
      executionJournalId: journal.executionJournalId,
      runtimeEnvelopeId: attempt.runtimeEnvelopeId,
      executionContractId: attempt.executionContractId,
      missionId: attempt.missionId,
    });

    const status = deriveExecutionEngineStatus({
      policy,
      attemptExists: true,
      attemptState: attempt.attemptState,
      attemptLifecycleState: attempt.attemptLifecycleState,
      journalExists: true,
      journalState: journal.journalState,
      runtimeEnvelopeState: runtimeEnvelope.envelopeState,
      runtimeEnvelopeEligibility: runtimeEnvelope.envelopeEligibility,
      contractState: contract.contractState,
      contractEligibilityState: contract.executionEligibilityState,
      founderEngineConfirmed: Boolean(input.founderEngineConfirmed),
      capabilityModelCompatible,
      historyEntries: history.entries,
    });

    const runOutputs = deriveRunOutputs({
      engineState: status.engineState,
      historyEntries: history.entries,
    });

    const historyDigest = computeHistoryDigest(history.entries);

    return {
      executionEngineRun: {
        executionEngineRunId,
        executionAttemptId: attempt.executionAttemptId,
        executionJournalId: journal.executionJournalId,
        runtimeEnvelopeId: attempt.runtimeEnvelopeId,
        executionContractId: attempt.executionContractId,
        missionId: attempt.missionId,
        selectedTeamId: runtimeEnvelope.selectedTeamId,
        enginePolicyId: policy.enginePolicyId,
        engineState: status.engineState,
        engineEligibilityState: status.engineEligibilityState,
        runMode,
        runInputs,
        runOutputs,
        blockingReasons: uniqueSorted(status.blockingReasons),
        limitations: uniqueSorted(status.limitations),
        provenanceInputs: {
          attemptState: attempt.attemptState,
          attemptLifecycleState: attempt.attemptLifecycleState,
          attemptBlockers: uniqueSorted(attempt.blockers),
          attemptLimitations: uniqueSorted(attempt.limitations),
          journalState: journal.journalState,
          journalEventCount: journal.eventCount,
          journalBlockers: uniqueSorted(journal.blockers),
          journalLimitations: uniqueSorted(journal.limitations),
          runtimeEnvelopeState: runtimeEnvelope.envelopeState,
          runtimeEnvelopeEligibility: runtimeEnvelope.envelopeEligibility,
          runtimeEnvelopeBlockers: uniqueSorted(runtimeEnvelope.blockers),
          runtimeEnvelopeLimitations: uniqueSorted(runtimeEnvelope.limitations),
          contractState: contract.contractState,
          contractEligibilityState: contract.executionEligibilityState,
          contractBlockers: uniqueSorted(contract.remainingBlockers),
          contractLimitations: uniqueSorted(contract.limitations),
        },
        historyDigest,
      },
      policy,
    };
  }

  function evaluateAllExecutionEngineRuns(input: {
    enginePolicyId?: string;
    runMode?: ExecutionEngineRunMode;
    founderEngineConfirmed?: boolean;
  } = {}): ExecutionEngineEvaluationResult[] {
    return executionAttemptProjection
      .projectAll()
      .flatMap((entry) => {
        try {
          return [evaluateExecutionEngineRun({
            executionAttemptId: entry.executionAttemptId,
            enginePolicyId: input.enginePolicyId,
            runMode: input.runMode,
            founderEngineConfirmed: input.founderEngineConfirmed,
          })];
        } catch {
          return [];
        }
      })
      .sort((left, right) => left.executionEngineRun.executionEngineRunId.localeCompare(right.executionEngineRun.executionEngineRunId));
  }

  return {
    evaluateExecutionEngineRun,
    evaluateAllExecutionEngineRuns,
  };
}

export type ExecutionEngineEvaluator = ReturnType<typeof createExecutionEngineEvaluator>;
