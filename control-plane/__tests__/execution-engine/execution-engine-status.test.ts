import { describe, expect, it } from 'vitest';

import { getExecutionEnginePolicy } from '../../execution-engine/execution-engine-policies.ts';
import { deriveExecutionEngineStatus } from '../../execution-engine/execution-engine-status.ts';

describe('execution engine status', () => {
  it('T-MEE-S1 derives eligible_to_start for fully ready inputs', () => {
    const status = deriveExecutionEngineStatus({
      policy: getExecutionEnginePolicy('simulation-only-default'),
      attemptExists: true,
      attemptState: 'pending',
      attemptLifecycleState: 'ready_for_execution',
      journalExists: true,
      journalState: 'ready_for_runtime_events',
      runtimeEnvelopeState: 'ready_for_runtime',
      runtimeEnvelopeEligibility: 'eligible',
      contractState: 'ready_for_runtime_handoff',
      contractEligibilityState: 'eligible',
      founderEngineConfirmed: false,
      capabilityModelCompatible: true,
    });

    expect(status.engineEligibilityState).toBe('eligible');
    expect(status.engineState).toBe('eligible_to_start');
  });

  it('T-MEE-S2 derives blocked when hard blockers are present', () => {
    const status = deriveExecutionEngineStatus({
      policy: getExecutionEnginePolicy('simulation-only-default'),
      attemptExists: true,
      attemptState: 'blocked',
      attemptLifecycleState: 'ready_for_execution',
      journalExists: true,
      journalState: 'ready_for_runtime_events',
      runtimeEnvelopeState: 'blocked',
      runtimeEnvelopeEligibility: 'blocked',
      contractState: 'blocked',
      contractEligibilityState: 'blocked',
      founderEngineConfirmed: false,
      capabilityModelCompatible: true,
    });

    expect(status.engineEligibilityState).toBe('blocked');
    expect(status.blockingReasons).toContain('execution_attempt_not_eligible');
    expect(status.blockingReasons).toContain('runtime_envelope_blocked');
  });

  it('T-MEE-S3 derives waiting_on_support for non-ready journal', () => {
    const status = deriveExecutionEngineStatus({
      policy: getExecutionEnginePolicy('simulation-only-default'),
      attemptExists: true,
      attemptState: 'pending',
      attemptLifecycleState: 'ready_for_execution',
      journalExists: true,
      journalState: 'collecting',
      runtimeEnvelopeState: 'under_review',
      runtimeEnvelopeEligibility: 'waiting_on_runtime_support',
      contractState: 'evaluated',
      contractEligibilityState: 'waiting_on_runtime_preparation',
      founderEngineConfirmed: false,
      capabilityModelCompatible: true,
    });

    expect(status.engineEligibilityState).toBe('waiting_on_support');
    expect(status.limitations).toContain('execution_journal_not_ready');
  });

  it('T-MEE-S4 terminal history events override pre-start state', () => {
    const status = deriveExecutionEngineStatus({
      policy: getExecutionEnginePolicy('simulation-only-default'),
      attemptExists: true,
      attemptState: 'pending',
      attemptLifecycleState: 'ready_for_execution',
      journalExists: true,
      journalState: 'ready_for_runtime_events',
      runtimeEnvelopeState: 'ready_for_runtime',
      runtimeEnvelopeEligibility: 'eligible',
      contractState: 'ready_for_runtime_handoff',
      contractEligibilityState: 'eligible',
      founderEngineConfirmed: false,
      capabilityModelCompatible: true,
      historyEntries: [
        {
          executionEngineRunId: 'er-1',
          executionAttemptId: 'ea-1',
          executionJournalId: 'ej-1',
          runtimeEnvelopeId: 're-1',
          executionContractId: 'ec-1',
          missionId: 'm-1',
          eventType: 'engine_run_started',
          eventDedupeKey: 'k-started',
          reasoning: 'started',
          payload: {},
        },
        {
          executionEngineRunId: 'er-1',
          executionAttemptId: 'ea-1',
          executionJournalId: 'ej-1',
          runtimeEnvelopeId: 're-1',
          executionContractId: 'ec-1',
          missionId: 'm-1',
          eventType: 'engine_run_completed',
          eventDedupeKey: 'k-completed',
          reasoning: 'completed',
          payload: {},
        },
      ],
    });

    expect(status.engineState).toBe('completed');
  });
});
