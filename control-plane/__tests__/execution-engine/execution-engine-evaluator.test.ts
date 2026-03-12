import { describe, expect, it } from 'vitest';

import { createExecutionEngineEvaluator } from '../../execution-engine/execution-engine-evaluator.ts';

interface Overrides {
  attemptState?: string;
  attemptLifecycleState?: string;
  journalState?: string;
  runtimeEnvelopeEligibility?: string;
  contractState?: string;
  contractEligibilityState?: string;
}

function createEvaluator(overrides: Overrides = {}) {
  const executionAttemptProjection = {
    projectOne: () => ({
      executionAttemptId: 'ea-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      attemptIndex: 1,
      executionPolicyId: 'strict-runtime-handoff-default',
      attemptState: overrides.attemptState ?? 'pending',
      attemptLifecycleState: overrides.attemptLifecycleState ?? 'ready_for_execution',
      attemptInputs: {
        inputParameters: {},
        environmentContext: {},
        targetRuntimeKind: 'team_runtime',
        resourceExpectations: {},
      },
      attemptCapabilities: {
        supportsTaskExecution: false,
        supportsRetries: false,
        supportsParallelTasks: false,
        supportsExternalCalls: false,
        supportsAgentInvocation: false,
      },
      blockers: [],
      limitations: [],
      provenanceInputs: {
        runtimeEnvelopeId: 're-1',
        executionContractId: 'ec-1',
        missionId: 'm-1',
        executionPolicyId: 'strict-runtime-handoff-default',
        runtimeEnvelopeState: 'ready_for_runtime',
        runtimeEnvelopeEligibility: 'eligible',
        runtimeEnvelopeBlockers: [],
        runtimeEnvelopeLimitations: [],
      },
    }),
    projectAll: () => [],
  };

  const executionJournalProjection = {
    projectOne: () => ({
      executionJournalId: 'ej-1',
      journalState: overrides.journalState ?? 'ready_for_runtime_events',
      eventCount: 2,
      blockers: [],
      limitations: [],
    }),
  };

  const runtimeEnvelopeProjection = {
    projectOne: () => ({
      selectedTeamId: 'team-a',
      envelopeState: 'ready_for_runtime',
      envelopeEligibility: overrides.runtimeEnvelopeEligibility ?? 'eligible',
      runtimePayload: {
        missionSummary: 'summary',
        deliverableScope: ['a'],
        scopeTags: ['core'],
        outOfScopeTags: ['none'],
        authorizedTeamId: 'team-a',
        executionPolicyId: 'strict-runtime-handoff-default',
      },
      executionTarget: 'team_runtime',
      runtimeCapabilities: {
        supportsTaskGraph: false,
        supportsRetries: false,
        supportsResourceBinding: false,
        supportsExternalAPIs: false,
        supportsParallelExecution: false,
        supportsAgentInvocation: false,
      },
      blockers: [],
      limitations: [],
    }),
  };

  const executionContractProjection = {
    projectOne: () => ({
      executionPolicyId: 'strict-runtime-handoff-default',
      contractState: overrides.contractState ?? 'ready_for_runtime_handoff',
      executionEligibilityState: overrides.contractEligibilityState ?? 'eligible',
      authorizedActions: ['prepare_execution_envelope'],
      prohibitedActions: ['dispatch_tasks'],
      remainingBlockers: [],
      limitations: [],
    }),
  };

  const historyStore = {
    load: () => ({
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      executionJournalId: 'ej-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      entries: [],
    }),
  };

  return createExecutionEngineEvaluator({
    executionAttemptProjection: executionAttemptProjection as never,
    executionJournalProjection: executionJournalProjection as never,
    runtimeEnvelopeProjection: runtimeEnvelopeProjection as never,
    executionContractProjection: executionContractProjection as never,
    historyStore: historyStore as never,
  });
}

describe('execution engine evaluator', () => {
  it('T-MEE-E1 computes deterministic run identity for identical inputs', () => {
    const evaluator = createEvaluator();

    const first = evaluator.evaluateExecutionEngineRun({ executionAttemptId: 'ea-1' });
    const second = evaluator.evaluateExecutionEngineRun({ executionAttemptId: 'ea-1' });

    expect(first.executionEngineRun.executionEngineRunId).toBe(second.executionEngineRun.executionEngineRunId);
    expect(first.executionEngineRun.engineEligibilityState).toBe('eligible');
    expect(first.executionEngineRun.engineState).toBe('eligible_to_start');
  });

  it('T-MEE-E2 reports blocked when contract is rejected', () => {
    const evaluator = createEvaluator({
      contractState: 'rejected',
      contractEligibilityState: 'blocked',
    });

    const result = evaluator.evaluateExecutionEngineRun({ executionAttemptId: 'ea-1' });
    expect(result.executionEngineRun.engineEligibilityState).toBe('blocked');
    expect(result.executionEngineRun.blockingReasons).toContain('execution_contract_blocked');
  });

  it('T-MEE-E3 reports waiting_on_support when journal is not ready', () => {
    const evaluator = createEvaluator({ journalState: 'collecting' });

    const result = evaluator.evaluateExecutionEngineRun({ executionAttemptId: 'ea-1' });
    expect(result.executionEngineRun.engineEligibilityState).toBe('waiting_on_support');
    expect(result.executionEngineRun.limitations).toContain('execution_journal_not_ready');
  });

  it('T-MEE-E4 rejects disabled policy deterministically', () => {
    const evaluator = createEvaluator();

    expect(() => evaluator.evaluateExecutionEngineRun({
      executionAttemptId: 'ea-1',
      enginePolicyId: 'bounded-local-execution',
    })).toThrowError('EXECUTION_ENGINE_POLICY_DISABLED');
  });

  it('T-MEE-E5 reports waiting_on_support when founder confirmation is required', () => {
    const evaluator = createEvaluator();

    const result = evaluator.evaluateExecutionEngineRun({
      executionAttemptId: 'ea-1',
      enginePolicyId: 'manual-engine-gated',
    });

    expect(result.executionEngineRun.engineEligibilityState).toBe('waiting_on_support');
    expect(result.executionEngineRun.limitations).toContain('founder_engine_confirmation_required');
  });
});
