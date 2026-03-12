import { describe, expect, it } from 'vitest';

import { createRuntimeEnvelopeEvaluator } from '../../runtime-envelope/runtime-envelope-evaluator.ts';

interface ContractOverrides {
  executionContractId?: string;
  executionTarget?: string;
  executionPolicyId?: string;
  executionEligibilityState?: string;
  contractState?: string;
  missionSummary?: string;
  selectedTeamId?: string;
}

function createEvaluator(overrides: ContractOverrides = {}) {
  const contract = {
    executionContractId: overrides.executionContractId ?? 'ec-1',
    missionId: 'mission-1',
    selectedTeamId: overrides.selectedTeamId ?? 'team-a',
    executionTarget: overrides.executionTarget ?? 'team_runtime',
    executionPolicyId: overrides.executionPolicyId ?? 'operator-reviewed-contract',
    executionEligibilityState: overrides.executionEligibilityState ?? 'eligible',
    contractState: overrides.contractState ?? 'ready_for_runtime_handoff',
    missionSummary: overrides.missionSummary ?? 'Ship v1 runtime payload.',
    deliverableScope: {
      requestedDeliverables: ['a', 'b'],
      missionObjective: 'obj',
      scopeTags: ['core', 'release'],
      outOfScopeTags: ['execution', 'scheduling'],
    },
    reasonTokens: ['token-a'],
    limitations: ['execution_contract_projection_only'],
    remainingBlockers: [],
  };

  const executionContractProjection = {
    projectAll: () => [contract],
  };

  return createRuntimeEnvelopeEvaluator({
    executionContractProjection: executionContractProjection as never,
  });
}

describe('runtime envelope evaluator', () => {
  it('T-MRE-E1 computes deterministic runtime envelope identity', () => {
    const evaluator = createEvaluator();

    const first = evaluator.evaluateRuntimeEnvelope({ executionContractId: 'ec-1' });
    const second = evaluator.evaluateRuntimeEnvelope({ executionContractId: 'ec-1' });

    expect(first).toEqual(second);
    expect(first.runtimeEnvelope.runtimeEnvelopeId).toHaveLength(64);
    expect(first.runtimeEnvelope.runtimeEnvelopeId).toBe(second.runtimeEnvelope.runtimeEnvelopeId);
  });

  it('T-MRE-E2 enforces fully disabled Sprint 5.2 runtime semantics', () => {
    const evaluator = createEvaluator();
    const result = evaluator.evaluateRuntimeEnvelope({ executionContractId: 'ec-1' });

    expect(result.runtimeEnvelope.runtimeCapabilities).toEqual({
      supportsTaskGraph: false,
      supportsRetries: false,
      supportsResourceBinding: false,
      supportsExternalAPIs: false,
      supportsParallelExecution: false,
      supportsAgentInvocation: false,
    });
    expect(result.runtimeEnvelope.taskGraphStub).toEqual({
      supported: false,
      nodes: [],
      edges: [],
    });
    expect(result.runtimeEnvelope.resourceBindings).toEqual({
      computeRequired: false,
      apiAccessRequired: false,
      llmInferenceRequired: false,
      storageRequired: false,
    });
  });

  it('T-MRE-E3 throws CONTRACT_NOT_ELIGIBLE for blocked execution contracts', () => {
    const evaluator = createEvaluator({ executionEligibilityState: 'blocked', contractState: 'blocked' });

    expect(() => evaluator.evaluateRuntimeEnvelope({ executionContractId: 'ec-1' })).toThrowError('CONTRACT_NOT_ELIGIBLE');
  });

  it('T-MRE-E4 throws UNSUPPORTED_RUNTIME_TARGET when target is unsupported', () => {
    const evaluator = createEvaluator({ executionTarget: 'unassigned_target' });

    expect(() => evaluator.evaluateRuntimeEnvelope({ executionContractId: 'ec-1' })).toThrowError('UNSUPPORTED_RUNTIME_TARGET');
  });

  it('T-MRE-E5 throws INVALID_RUNTIME_PAYLOAD when payload is incomplete', () => {
    const evaluator = createEvaluator({ missionSummary: '' });

    expect(() => evaluator.evaluateRuntimeEnvelope({ executionContractId: 'ec-1' })).toThrowError('INVALID_RUNTIME_PAYLOAD');
  });

  it('T-MRE-E6 throws RUNTIME_POLICY_DISABLED for disabled policy', () => {
    const evaluator = createEvaluator();

    expect(() => evaluator.evaluateRuntimeEnvelope({
      executionContractId: 'ec-1',
      runtimeEnvelopePolicyId: 'future-runtime-enabled',
    })).toThrowError('RUNTIME_POLICY_DISABLED');
  });
});
