import { describe, expect, it } from 'vitest';

import { createExecutionEngineRunner } from '../../execution-engine/execution-engine-runner.ts';

describe('execution engine runner', () => {
  it('T-MEE-R1 start transition appends journal execution_started', () => {
    let engineState = 'eligible_to_start';
    const journalEvents: string[] = [];

    const runner = createExecutionEngineRunner({
      evaluator: {
        evaluateExecutionEngineRun: () => ({
          executionEngineRun: {
            executionEngineRunId: 'er-1',
            executionAttemptId: 'ea-1',
            executionJournalId: 'ej-1',
            runtimeEnvelopeId: 're-1',
            executionContractId: 'ec-1',
            missionId: 'm-1',
            selectedTeamId: 'team-a',
            enginePolicyId: 'simulation-only-default',
            engineState,
            engineEligibilityState: 'eligible',
            runMode: 'simulation_only',
            runInputs: {
              normalizedRuntimePayload: {},
              executionTarget: 'team_runtime',
              allowedActions: [],
              prohibitedActions: [],
              capabilityFlags: {},
              engineMetadata: {},
            },
            runOutputs: {
              outputState: 'not_started',
              resultSummary: 'execution_engine_not_started',
              generatedArtifacts: [],
            },
            blockingReasons: [],
            limitations: [],
            provenanceInputs: {
              attemptState: 'pending',
              attemptLifecycleState: 'ready_for_execution',
              attemptBlockers: [],
              attemptLimitations: [],
              journalState: 'ready_for_runtime_events',
              journalEventCount: 1,
              journalBlockers: [],
              journalLimitations: [],
              runtimeEnvelopeState: 'ready_for_runtime',
              runtimeEnvelopeEligibility: 'eligible',
              runtimeEnvelopeBlockers: [],
              runtimeEnvelopeLimitations: [],
              contractState: 'ready_for_runtime_handoff',
              contractEligibilityState: 'eligible',
              contractBlockers: [],
              contractLimitations: [],
            },
            historyDigest: '',
          },
          policy: { enginePolicyId: 'simulation-only-default' },
        }),
      } as never,
      historyStore: {
        append: ({ eventType }: { eventType: string }) => {
          if (eventType === 'engine_run_started') {
            engineState = 'running';
          }
          return { history: { entries: [] }, appended: true, entry: {} };
        },
      } as never,
      journalHistoryStore: {
        append: ({ eventType }: { eventType: string }) => {
          journalEvents.push(eventType);
          return { history: { events: [] }, appended: true, event: {} };
        },
      } as never,
    });

    const result = runner.startRun({ executionAttemptId: 'ea-1' });
    expect(result.engineState).toBe('running');
    expect(journalEvents).toContain('execution_started');
  });

  it('T-MEE-R2 completion transition appends execution_completed', () => {
    let engineState = 'running';
    const journalEvents: string[] = [];

    const runner = createExecutionEngineRunner({
      evaluator: {
        evaluateExecutionEngineRun: () => ({
          executionEngineRun: {
            executionEngineRunId: 'er-1',
            executionAttemptId: 'ea-1',
            executionJournalId: 'ej-1',
            runtimeEnvelopeId: 're-1',
            executionContractId: 'ec-1',
            missionId: 'm-1',
            selectedTeamId: 'team-a',
            enginePolicyId: 'simulation-only-default',
            engineState,
            engineEligibilityState: 'eligible',
            runMode: 'simulation_only',
            runInputs: {
              normalizedRuntimePayload: {},
              executionTarget: 'team_runtime',
              allowedActions: [],
              prohibitedActions: [],
              capabilityFlags: {},
              engineMetadata: {},
            },
            runOutputs: {
              outputState: 'running',
              resultSummary: 'execution_engine_running',
              generatedArtifacts: [],
            },
            blockingReasons: [],
            limitations: [],
            provenanceInputs: {
              attemptState: 'pending',
              attemptLifecycleState: 'ready_for_execution',
              attemptBlockers: [],
              attemptLimitations: [],
              journalState: 'ready_for_runtime_events',
              journalEventCount: 1,
              journalBlockers: [],
              journalLimitations: [],
              runtimeEnvelopeState: 'ready_for_runtime',
              runtimeEnvelopeEligibility: 'eligible',
              runtimeEnvelopeBlockers: [],
              runtimeEnvelopeLimitations: [],
              contractState: 'ready_for_runtime_handoff',
              contractEligibilityState: 'eligible',
              contractBlockers: [],
              contractLimitations: [],
            },
            historyDigest: '',
          },
          policy: { enginePolicyId: 'simulation-only-default' },
        }),
      } as never,
      historyStore: {
        append: ({ eventType }: { eventType: string }) => {
          if (eventType === 'engine_run_completed') {
            engineState = 'completed';
          }
          return { history: { entries: [] }, appended: true, entry: {} };
        },
      } as never,
      journalHistoryStore: {
        append: ({ eventType }: { eventType: string }) => {
          journalEvents.push(eventType);
          return { history: { events: [] }, appended: true, event: {} };
        },
      } as never,
    });

    const result = runner.completeRun({ executionAttemptId: 'ea-1' });
    expect(result.engineState).toBe('completed');
    expect(journalEvents).toContain('execution_completed');
  });

  it('T-MEE-R3 failure and cancellation transitions append journal events', () => {
    const journalEvents: string[] = [];

    const baseRun = {
      executionEngineRunId: 'er-1',
      executionAttemptId: 'ea-1',
      executionJournalId: 'ej-1',
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm-1',
      selectedTeamId: 'team-a',
      enginePolicyId: 'simulation-only-default',
      engineState: 'running',
      engineEligibilityState: 'eligible',
      runMode: 'simulation_only',
      runInputs: {
        normalizedRuntimePayload: {},
        executionTarget: 'team_runtime',
        allowedActions: [],
        prohibitedActions: [],
        capabilityFlags: {},
        engineMetadata: {},
      },
      runOutputs: {
        outputState: 'running',
        resultSummary: 'execution_engine_running',
        generatedArtifacts: [],
      },
      blockingReasons: [],
      limitations: [],
      provenanceInputs: {
        attemptState: 'pending',
        attemptLifecycleState: 'ready_for_execution',
        attemptBlockers: [],
        attemptLimitations: [],
        journalState: 'ready_for_runtime_events',
        journalEventCount: 1,
        journalBlockers: [],
        journalLimitations: [],
        runtimeEnvelopeState: 'ready_for_runtime',
        runtimeEnvelopeEligibility: 'eligible',
        runtimeEnvelopeBlockers: [],
        runtimeEnvelopeLimitations: [],
        contractState: 'ready_for_runtime_handoff',
        contractEligibilityState: 'eligible',
        contractBlockers: [],
        contractLimitations: [],
      },
      historyDigest: '',
    };

    const runner = createExecutionEngineRunner({
      evaluator: {
        evaluateExecutionEngineRun: () => ({ executionEngineRun: baseRun, policy: { enginePolicyId: 'simulation-only-default' } }),
      } as never,
      historyStore: {
        append: () => ({ history: { entries: [] }, appended: true, entry: {} }),
      } as never,
      journalHistoryStore: {
        append: ({ eventType }: { eventType: string }) => {
          journalEvents.push(eventType);
          return { history: { events: [] }, appended: true, event: {} };
        },
      } as never,
    });

    runner.failRun({ executionAttemptId: 'ea-1', failureReason: 'failure' });
    runner.cancelRun({ executionAttemptId: 'ea-1', cancellationReason: 'cancelled' });

    expect(journalEvents).toContain('execution_failed');
    expect(journalEvents).toContain('execution_cancelled');
  });

  it('T-MEE-R4 invalid transition fails deterministically', () => {
    const runner = createExecutionEngineRunner({
      evaluator: {
        evaluateExecutionEngineRun: () => ({
          executionEngineRun: {
            executionEngineRunId: 'er-1',
            executionAttemptId: 'ea-1',
            executionJournalId: 'ej-1',
            runtimeEnvelopeId: 're-1',
            executionContractId: 'ec-1',
            missionId: 'm-1',
            selectedTeamId: 'team-a',
            enginePolicyId: 'simulation-only-default',
            engineState: 'initialized',
            engineEligibilityState: 'blocked',
            runMode: 'simulation_only',
            runInputs: {
              normalizedRuntimePayload: {},
              executionTarget: 'team_runtime',
              allowedActions: [],
              prohibitedActions: [],
              capabilityFlags: {},
              engineMetadata: {},
            },
            runOutputs: {
              outputState: 'not_started',
              resultSummary: 'execution_engine_not_started',
              generatedArtifacts: [],
            },
            blockingReasons: ['execution_journal_blocked'],
            limitations: [],
            provenanceInputs: {
              attemptState: 'blocked',
              attemptLifecycleState: 'ready_for_execution',
              attemptBlockers: [],
              attemptLimitations: [],
              journalState: 'blocked',
              journalEventCount: 0,
              journalBlockers: [],
              journalLimitations: [],
              runtimeEnvelopeState: 'blocked',
              runtimeEnvelopeEligibility: 'blocked',
              runtimeEnvelopeBlockers: [],
              runtimeEnvelopeLimitations: [],
              contractState: 'blocked',
              contractEligibilityState: 'blocked',
              contractBlockers: [],
              contractLimitations: [],
            },
            historyDigest: '',
          },
          policy: { enginePolicyId: 'simulation-only-default' },
        }),
      } as never,
      historyStore: {
        append: () => ({ history: { entries: [] }, appended: true, entry: {} }),
      } as never,
      journalHistoryStore: {
        append: () => ({ history: { events: [] }, appended: true, event: {} }),
      } as never,
    });

    expect(() => runner.completeRun({ executionAttemptId: 'ea-1' })).toThrowError('EXECUTION_ENGINE_INVALID_TRANSITION: initialized -> completed');
  });
});
