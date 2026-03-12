import { describe, expect, it } from 'vitest';

import { createExecutionAttemptEvaluator } from '../../execution-attempt/execution-attempt-evaluator.ts';

interface EnvelopeOverrides {
  runtimeEnvelopeId?: string;
  executionContractId?: string;
  missionId?: string;
  selectedTeamId?: string;
  executionTarget?: string;
  executionPolicyId?: string;
  envelopeState?: string;
  envelopeEligibility?: string;
  blockers?: string[];
  limitations?: string[];
}

function createEvaluator(overrides: EnvelopeOverrides = {}) {
  const envelope = {
    runtimeEnvelopeId: overrides.runtimeEnvelopeId ?? 're-1',
    executionContractId: overrides.executionContractId ?? 'ec-1',
    missionId: overrides.missionId ?? 'mission-1',
    selectedTeamId: overrides.selectedTeamId ?? 'team-a',
    executionTarget: overrides.executionTarget ?? 'team_runtime',
    runtimePayload: {
      missionSummary: 'summary',
      deliverableScope: ['a'],
      scopeTags: ['core'],
      outOfScopeTags: ['none'],
      authorizedTeamId: 'team-a',
      executionPolicyId: overrides.executionPolicyId ?? 'strict-runtime-handoff-default',
    },
    envelopeState: overrides.envelopeState ?? 'ready_for_runtime',
    envelopeEligibility: overrides.envelopeEligibility ?? 'eligible',
    blockers: overrides.blockers ?? [],
    limitations: overrides.limitations ?? ['runtime_envelope_projection_only'],
  };

  const runtimeEnvelopeProjection = {
    projectOne: () => envelope,
    projectAll: () => [envelope],
  };

  return createExecutionAttemptEvaluator({
    runtimeEnvelopeProjection: runtimeEnvelopeProjection as never,
  });
}

describe('execution attempt evaluator', () => {
  it('T-MEA-E1 computes deterministic execution attempt identity', () => {
    const evaluator = createEvaluator();

    const first = evaluator.evaluateExecutionAttempt({ runtimeEnvelopeId: 're-1' });
    const second = evaluator.evaluateExecutionAttempt({ runtimeEnvelopeId: 're-1' });

    expect(first).toEqual(second);
    expect(first.executionAttempt.executionAttemptId).toHaveLength(64);
    expect(first.executionAttempt.executionAttemptId).toBe(second.executionAttempt.executionAttemptId);
  });

  it('T-MEA-E2 defaults all execution capability flags to false', () => {
    const evaluator = createEvaluator();
    const result = evaluator.evaluateExecutionAttempt({ runtimeEnvelopeId: 're-1' });

    expect(result.executionAttempt.attemptCapabilities).toEqual({
      supportsTaskExecution: false,
      supportsRetries: false,
      supportsParallelTasks: false,
      supportsExternalCalls: false,
      supportsAgentInvocation: false,
    });
  });

  it('T-MEA-E3 includes attemptIndex and normalized inputs in identity', () => {
    const evaluator = createEvaluator();

    const baseline = evaluator.evaluateExecutionAttempt({ runtimeEnvelopeId: 're-1', attemptIndex: 1 });
    const differentIndex = evaluator.evaluateExecutionAttempt({ runtimeEnvelopeId: 're-1', attemptIndex: 2 });
    const differentInputs = evaluator.evaluateExecutionAttempt({
      runtimeEnvelopeId: 're-1',
      attemptIndex: 1,
      attemptInputs: {
        inputParameters: { z: '2', a: '1' },
        environmentContext: { region: 'local' },
        targetRuntimeKind: 'team_runtime',
        resourceExpectations: { network: 'none' },
      },
    });

    expect(differentIndex.executionAttempt.executionAttemptId).not.toBe(baseline.executionAttempt.executionAttemptId);
    expect(differentInputs.executionAttempt.executionAttemptId).not.toBe(baseline.executionAttempt.executionAttemptId);
  });

  it('T-MEA-E4 maps blocked runtime envelope to blocked attempt state', () => {
    const evaluator = createEvaluator({
      envelopeState: 'blocked',
      envelopeEligibility: 'blocked',
      blockers: ['runtime_envelope_blocked'],
    });

    const result = evaluator.evaluateExecutionAttempt({ runtimeEnvelopeId: 're-1' });
    expect(result.executionAttempt.attemptState).toBe('blocked');
    expect(result.executionAttempt.blockers).toContain('runtime_envelope_blocked');
  });

  it('T-MEA-E5 rejects invalid attempt index values', () => {
    const evaluator = createEvaluator();

    expect(() => evaluator.evaluateExecutionAttempt({ runtimeEnvelopeId: 're-1', attemptIndex: 0 })).toThrowError('INVALID_EXECUTION_ATTEMPT_INPUTS');
  });
});
