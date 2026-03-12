import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  createRuntimeEnvelopeProjection,
  type RuntimeEnvelopeProjectionEngine,
} from '../runtime-envelope/runtime-envelope-projection.ts';

import {
  DEFAULT_EXECUTION_ATTEMPT_POLICY_ID,
  getExecutionAttemptPolicy,
} from './execution-attempt-policies.ts';
import type {
  ExecutionAttemptPolicy,
  ExecutionAttemptEvaluationResult,
} from './execution-attempt-policy-types.ts';
import { deriveExecutionAttemptStatus } from './execution-attempt-status.ts';
import type {
  ExecutionAttemptCapabilities,
  ExecutionAttemptInputs,
  MissionExecutionAttempt,
  MissionExecutionAttemptHistoryEntry,
} from './execution-attempt-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function normalizeStringRecord(values: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(values)
    .map(([key, value]) => [key, String(value)])
    .sort(([left], [right]) => left.localeCompare(right)));
}

function normalizeAttemptInputs(inputs: ExecutionAttemptInputs): ExecutionAttemptInputs {
  return {
    inputParameters: normalizeStringRecord(inputs.inputParameters),
    environmentContext: normalizeStringRecord(inputs.environmentContext),
    targetRuntimeKind: inputs.targetRuntimeKind,
    resourceExpectations: normalizeStringRecord(inputs.resourceExpectations),
  };
}

function deriveDefaultAttemptInputs(input: {
  missionId: string;
  runtimeEnvelopeId: string;
  executionContractId: string;
  selectedTeamId: string;
  targetRuntimeKind: string;
}): ExecutionAttemptInputs {
  return normalizeAttemptInputs({
    inputParameters: {
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      selectedTeamId: input.selectedTeamId,
    },
    environmentContext: {
      executionContractId: input.executionContractId,
      missionId: input.missionId,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
    },
    targetRuntimeKind: input.targetRuntimeKind,
    resourceExpectations: {
      compute: 'none',
      network: 'none',
      storage: 'none',
    },
  });
}

function validateAttemptInputs(inputs: ExecutionAttemptInputs): void {
  if (!inputs.targetRuntimeKind || inputs.targetRuntimeKind.length === 0) {
    throw new Error('INVALID_EXECUTION_ATTEMPT_INPUTS');
  }
}

function deriveAttemptCapabilities(_policy: ExecutionAttemptPolicy): ExecutionAttemptCapabilities {
  return {
    supportsTaskExecution: false,
    supportsRetries: false,
    supportsParallelTasks: false,
    supportsExternalCalls: false,
    supportsAgentInvocation: false,
  };
}

function deriveExecutionAttemptId(input: {
  runtimeEnvelopeId: string;
  attemptIndex: number;
  attemptInputs: ExecutionAttemptInputs;
  executionPolicyId: string;
}): string {
  const identityPayload = {
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    attemptIndex: input.attemptIndex,
    normalizedAttemptInputs: normalizeAttemptInputs(input.attemptInputs),
    executionPolicyId: input.executionPolicyId,
  };

  return sha256(canonicalStringify(identityPayload));
}

function validateAttemptIndex(attemptIndex: number): void {
  if (!Number.isInteger(attemptIndex) || attemptIndex < 1) {
    throw new Error('INVALID_EXECUTION_ATTEMPT_INPUTS');
  }
}

function resolveRuntimeEnvelopeById(input: {
  runtimeEnvelopeProjection: RuntimeEnvelopeProjectionEngine;
  runtimeEnvelopeId: string;
  runtimeEnvelopePolicyId?: string;
}) {
  return input.runtimeEnvelopeProjection.projectOne({
    runtimeEnvelopeId: input.runtimeEnvelopeId,
    runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
  });
}

export interface ExecutionAttemptEvaluatorResult {
  executionAttempt: MissionExecutionAttempt;
  evaluation: ExecutionAttemptEvaluationResult;
}

export function createExecutionAttemptEvaluator(options: {
  runtimeEnvelopeProjection?: RuntimeEnvelopeProjectionEngine;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
} = {}) {
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

  function evaluateExecutionAttempt(input: {
    runtimeEnvelopeId: string;
    attemptIndex?: number;
    attemptInputs?: ExecutionAttemptInputs;
    executionAttemptPolicyId?: string;
    runtimeEnvelopePolicyId?: string;
    historyEntries?: MissionExecutionAttemptHistoryEntry[];
  }): ExecutionAttemptEvaluatorResult {
    const policy = getExecutionAttemptPolicy(input.executionAttemptPolicyId ?? DEFAULT_EXECUTION_ATTEMPT_POLICY_ID);
    if (!policy.enabled) {
      throw new Error('EXECUTION_ATTEMPT_POLICY_DISABLED');
    }

    const attemptIndex = input.attemptIndex ?? 1;
    validateAttemptIndex(attemptIndex);

    const envelope = resolveRuntimeEnvelopeById({
      runtimeEnvelopeProjection,
      runtimeEnvelopeId: input.runtimeEnvelopeId,
      runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
    });

    const attemptInputs = normalizeAttemptInputs(input.attemptInputs ?? deriveDefaultAttemptInputs({
      missionId: envelope.missionId,
      runtimeEnvelopeId: envelope.runtimeEnvelopeId,
      executionContractId: envelope.executionContractId,
      selectedTeamId: envelope.selectedTeamId,
      targetRuntimeKind: envelope.executionTarget,
    }));

    validateAttemptInputs(attemptInputs);

    const attemptCapabilities = deriveAttemptCapabilities(policy);

    const evaluation = deriveExecutionAttemptStatus({
      runtimeEnvelopeEligibility: envelope.envelopeEligibility,
      runtimeEnvelopeState: envelope.envelopeState,
      runtimeEnvelopeBlockers: envelope.blockers,
      runtimeEnvelopeLimitations: envelope.limitations,
      historyEntries: input.historyEntries,
    });

    const executionAttemptId = deriveExecutionAttemptId({
      runtimeEnvelopeId: envelope.runtimeEnvelopeId,
      attemptIndex,
      attemptInputs,
      executionPolicyId: envelope.runtimePayload.executionPolicyId,
    });

    return {
      executionAttempt: {
        executionAttemptId,
        runtimeEnvelopeId: envelope.runtimeEnvelopeId,
        executionContractId: envelope.executionContractId,
        missionId: envelope.missionId,
        attemptIndex,
        executionPolicyId: envelope.runtimePayload.executionPolicyId,
        attemptState: evaluation.attemptState,
        attemptLifecycleState: evaluation.attemptLifecycleState,
        attemptInputs,
        attemptCapabilities,
        limitations: uniqueSorted(evaluation.limitations),
        blockers: uniqueSorted(evaluation.blockers),
        provenanceInputs: {
          runtimeEnvelopeId: envelope.runtimeEnvelopeId,
          executionContractId: envelope.executionContractId,
          missionId: envelope.missionId,
          executionPolicyId: envelope.runtimePayload.executionPolicyId,
          runtimeEnvelopeState: envelope.envelopeState,
          runtimeEnvelopeEligibility: envelope.envelopeEligibility,
          runtimeEnvelopeBlockers: uniqueSorted(envelope.blockers),
          runtimeEnvelopeLimitations: uniqueSorted(envelope.limitations),
        },
      },
      evaluation,
    };
  }

  function evaluateAllExecutionAttempts(input: {
    executionAttemptPolicyId?: string;
    runtimeEnvelopePolicyId?: string;
  } = {}): ExecutionAttemptEvaluatorResult[] {
    const envelopes = runtimeEnvelopeProjection.projectAll({
      runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
    });

    return envelopes
      .flatMap((envelope) => {
        try {
          return [evaluateExecutionAttempt({
            runtimeEnvelopeId: envelope.runtimeEnvelopeId,
            attemptIndex: 1,
            executionAttemptPolicyId: input.executionAttemptPolicyId,
            runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
          })];
        } catch {
          return [];
        }
      })
      .sort((left, right) => left.executionAttempt.runtimeEnvelopeId.localeCompare(right.executionAttempt.runtimeEnvelopeId));
  }

  function getPolicy(executionAttemptPolicyId?: string): ExecutionAttemptPolicy {
    return getExecutionAttemptPolicy(executionAttemptPolicyId ?? DEFAULT_EXECUTION_ATTEMPT_POLICY_ID);
  }

  return {
    evaluateExecutionAttempt,
    evaluateAllExecutionAttempts,
    getPolicy,
  };
}

export type ExecutionAttemptEvaluator = ReturnType<typeof createExecutionAttemptEvaluator>;
