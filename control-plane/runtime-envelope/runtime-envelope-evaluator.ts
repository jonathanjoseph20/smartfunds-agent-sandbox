import { canonicalStringify, sha256 } from '../finance/determinism.ts';
import {
  createExecutionContractProjection,
  type ExecutionContractProjectionEngine,
} from '../execution-contract/execution-contract-projection.ts';
import type { MissionExecutionContractProjection } from '../execution-contract/execution-contract-types.ts';

import {
  DEFAULT_RUNTIME_ENVELOPE_POLICY_ID,
  getRuntimeEnvelopePolicy,
} from './runtime-envelope-policies.ts';
import type { RuntimeEnvelopePolicy } from './runtime-envelope-policy-types.ts';
import { deriveRuntimeEnvelopeStatus } from './runtime-envelope-status.ts';
import type {
  ExecutionTargetKind,
  MissionRuntimeEnvelope,
  MissionRuntimeEnvelopeHistoryEntry,
  ResourceBindingStub,
  RuntimeCapabilities,
  RuntimePayload,
  TaskGraphStub,
} from './runtime-envelope-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function normalizeRuntimePayload(payload: RuntimePayload): RuntimePayload {
  return {
    missionSummary: payload.missionSummary,
    deliverableScope: uniqueSorted(payload.deliverableScope),
    scopeTags: uniqueSorted(payload.scopeTags),
    outOfScopeTags: uniqueSorted(payload.outOfScopeTags),
    authorizedTeamId: payload.authorizedTeamId,
    executionPolicyId: payload.executionPolicyId,
  };
}

function deriveRuntimePayload(contract: MissionExecutionContractProjection): RuntimePayload {
  return normalizeRuntimePayload({
    missionSummary: contract.missionSummary,
    deliverableScope: contract.deliverableScope.requestedDeliverables,
    scopeTags: contract.deliverableScope.scopeTags,
    outOfScopeTags: contract.deliverableScope.outOfScopeTags,
    authorizedTeamId: contract.selectedTeamId,
    executionPolicyId: contract.executionPolicyId,
  });
}

function validateRuntimePayload(payload: RuntimePayload): void {
  if (!payload.missionSummary) {
    throw new Error('INVALID_RUNTIME_PAYLOAD');
  }
  if (!payload.authorizedTeamId) {
    throw new Error('INVALID_RUNTIME_PAYLOAD');
  }
  if (!payload.executionPolicyId) {
    throw new Error('INVALID_RUNTIME_PAYLOAD');
  }
}

function deriveRuntimeCapabilities(_policy: RuntimeEnvelopePolicy): RuntimeCapabilities {
  return {
    supportsTaskGraph: false,
    supportsRetries: false,
    supportsResourceBinding: false,
    supportsExternalAPIs: false,
    supportsParallelExecution: false,
    supportsAgentInvocation: false,
  };
}

function deriveTaskGraphStub(_policy: RuntimeEnvelopePolicy): TaskGraphStub {
  return {
    supported: false,
    nodes: [],
    edges: [],
  };
}

function deriveResourceBindings(_policy: RuntimeEnvelopePolicy): ResourceBindingStub {
  return {
    computeRequired: false,
    apiAccessRequired: false,
    llmInferenceRequired: false,
    storageRequired: false,
  };
}

function deriveRuntimeEnvelopeId(input: {
  executionContractId: string;
  executionTarget: ExecutionTargetKind;
  runtimePayload: RuntimePayload;
  runtimeCapabilities: RuntimeCapabilities;
  executionPolicyId: string;
}): string {
  const identityPayload = {
    executionContractId: input.executionContractId,
    executionTarget: input.executionTarget,
    runtimePayload: normalizeRuntimePayload(input.runtimePayload),
    runtimeCapabilities: input.runtimeCapabilities,
    executionPolicyId: input.executionPolicyId,
  };

  return sha256(canonicalStringify(identityPayload));
}

function validateExecutionTarget(input: {
  executionTarget: string;
  policy: RuntimeEnvelopePolicy;
}): asserts input is { executionTarget: ExecutionTargetKind; policy: RuntimeEnvelopePolicy } {
  const executionTarget = input.executionTarget as ExecutionTargetKind;
  if (!input.policy.config.allowedExecutionTargets.includes(executionTarget)) {
    throw new Error('UNSUPPORTED_RUNTIME_TARGET');
  }
}

function resolveContractByExecutionContractId(input: {
  executionContractProjection: ExecutionContractProjectionEngine;
  executionContractId: string;
}): MissionExecutionContractProjection {
  const projected = input.executionContractProjection
    .projectAll()
    .find((entry) => entry.executionContractId === input.executionContractId);

  if (!projected) {
    throw new Error('EXECUTION_CONTRACT_NOT_FOUND');
  }

  return projected;
}

export interface RuntimeEnvelopeEvaluationResult {
  runtimeEnvelope: MissionRuntimeEnvelope;
}

export function createRuntimeEnvelopeEvaluator(options: {
  executionContractProjection?: ExecutionContractProjectionEngine;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
} = {}) {
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

  function evaluateRuntimeEnvelope(input: {
    executionContractId: string;
    runtimeEnvelopePolicyId?: string;
    historyEntries?: MissionRuntimeEnvelopeHistoryEntry[];
  }): RuntimeEnvelopeEvaluationResult {
    const policy = getRuntimeEnvelopePolicy(input.runtimeEnvelopePolicyId ?? DEFAULT_RUNTIME_ENVELOPE_POLICY_ID);
    if (!policy.enabled) {
      throw new Error('RUNTIME_POLICY_DISABLED');
    }

    const contract = resolveContractByExecutionContractId({
      executionContractProjection,
      executionContractId: input.executionContractId,
    });

    validateExecutionTarget({
      executionTarget: contract.executionTarget,
      policy,
    });

    if (contract.executionEligibilityState === 'blocked' || contract.contractState === 'rejected') {
      throw new Error('CONTRACT_NOT_ELIGIBLE');
    }

    const runtimePayload = deriveRuntimePayload(contract);
    validateRuntimePayload(runtimePayload);

    const runtimeCapabilities = deriveRuntimeCapabilities(policy);
    const taskGraphStub = deriveTaskGraphStub(policy);
    const resourceBindings = deriveResourceBindings(policy);

    const status = deriveRuntimeEnvelopeStatus({
      executionEligibilityState: contract.executionEligibilityState,
      contractState: contract.contractState,
      contractBlockers: contract.remainingBlockers,
      contractLimitations: contract.limitations,
      historyEntries: input.historyEntries,
    });

    const runtimeEnvelopeId = deriveRuntimeEnvelopeId({
      executionContractId: contract.executionContractId,
      executionTarget: contract.executionTarget as ExecutionTargetKind,
      runtimePayload,
      runtimeCapabilities,
      executionPolicyId: contract.executionPolicyId,
    });

    return {
      runtimeEnvelope: {
        runtimeEnvelopeId,
        executionContractId: contract.executionContractId,
        missionId: contract.missionId,
        selectedTeamId: contract.selectedTeamId,
        executionTarget: contract.executionTarget as ExecutionTargetKind,
        runtimePayload,
        runtimeCapabilities,
        taskGraphStub,
        resourceBindings,
        envelopeState: status.envelopeState,
        envelopeEligibility: status.envelopeEligibility,
        limitations: uniqueSorted(status.limitations),
        blockers: uniqueSorted(status.blockers),
        provenanceInputs: {
          executionContractState: contract.contractState,
          executionEligibilityState: contract.executionEligibilityState,
          contractReasonTokens: uniqueSorted(contract.reasonTokens),
          contractLimitations: uniqueSorted(contract.limitations),
          contractBlockers: uniqueSorted(contract.remainingBlockers),
        },
      },
    };
  }

  function evaluateAllRuntimeEnvelopes(input: {
    runtimeEnvelopePolicyId?: string;
  } = {}): RuntimeEnvelopeEvaluationResult[] {
    const contracts = executionContractProjection.projectAll();

    return contracts
      .flatMap((contract) => {
        try {
          return [evaluateRuntimeEnvelope({
            executionContractId: contract.executionContractId,
            runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId,
          })];
        } catch {
          return [];
        }
      })
      .sort((left, right) => left.runtimeEnvelope.executionContractId.localeCompare(right.runtimeEnvelope.executionContractId));
  }

  function getPolicy(runtimeEnvelopePolicyId?: string): RuntimeEnvelopePolicy {
    return getRuntimeEnvelopePolicy(runtimeEnvelopePolicyId ?? DEFAULT_RUNTIME_ENVELOPE_POLICY_ID);
  }

  function resolveExecutionContractIdFromEnvelopeId(input: {
    runtimeEnvelopeId: string;
    runtimeEnvelopePolicyId?: string;
  }): string {
    const envelope = evaluateAllRuntimeEnvelopes({ runtimeEnvelopePolicyId: input.runtimeEnvelopePolicyId })
      .find((entry) => entry.runtimeEnvelope.runtimeEnvelopeId === input.runtimeEnvelopeId);

    if (!envelope) {
      throw new Error('RUNTIME_ENVELOPE_NOT_FOUND');
    }

    return envelope.runtimeEnvelope.executionContractId;
  }

  return {
    evaluateRuntimeEnvelope,
    evaluateAllRuntimeEnvelopes,
    getPolicy,
    resolveExecutionContractIdFromEnvelopeId,
  };
}

export type RuntimeEnvelopeEvaluator = ReturnType<typeof createRuntimeEnvelopeEvaluator>;
