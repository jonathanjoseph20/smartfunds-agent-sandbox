import { describe, expect, it } from 'vitest';

import { deriveExecutionAttemptStatus } from '../../execution-attempt/execution-attempt-status.ts';

describe('execution attempt status', () => {
  it('T-MEA-S1 derives pending status and created lifecycle by default', () => {
    const status = deriveExecutionAttemptStatus({
      runtimeEnvelopeEligibility: 'eligible',
      runtimeEnvelopeState: 'evaluated',
      runtimeEnvelopeBlockers: [],
      runtimeEnvelopeLimitations: [],
    });

    expect(status.attemptState).toBe('pending');
    expect(status.attemptLifecycleState).toBe('created');
  });

  it('T-MEA-S2 keeps waiting status distinct from lifecycle', () => {
    const status = deriveExecutionAttemptStatus({
      runtimeEnvelopeEligibility: 'waiting_on_runtime_support',
      runtimeEnvelopeState: 'under_review',
      runtimeEnvelopeBlockers: [],
      runtimeEnvelopeLimitations: [],
      historyEntries: [{
        executionAttemptId: 'ea-1',
        runtimeEnvelopeId: 're-1',
        executionContractId: 'ec-1',
        missionId: 'm1',
        eventType: 'execution_attempt_created',
        eventDedupeKey: 'k-created',
        reasoning: 'created',
        payload: {},
      }],
    });

    expect(status.attemptState).toBe('waiting_on_runtime_support');
    expect(status.attemptLifecycleState).toBe('prepared');
  });

  it('T-MEA-S3 transitions to ready_for_execution after created + evaluated events', () => {
    const status = deriveExecutionAttemptStatus({
      runtimeEnvelopeEligibility: 'eligible',
      runtimeEnvelopeState: 'ready_for_runtime',
      runtimeEnvelopeBlockers: [],
      runtimeEnvelopeLimitations: [],
      historyEntries: [
        {
          executionAttemptId: 'ea-1',
          runtimeEnvelopeId: 're-1',
          executionContractId: 'ec-1',
          missionId: 'm1',
          eventType: 'execution_attempt_created',
          eventDedupeKey: 'k-created',
          reasoning: 'created',
          payload: {},
        },
        {
          executionAttemptId: 'ea-1',
          runtimeEnvelopeId: 're-1',
          executionContractId: 'ec-1',
          missionId: 'm1',
          eventType: 'execution_attempt_status_evaluated',
          eventDedupeKey: 'k-evaluated',
          reasoning: 'evaluated',
          payload: {},
        },
      ],
    });

    expect(status.attemptState).toBe('pending');
    expect(status.attemptLifecycleState).toBe('ready_for_execution');
  });

  it('T-MEA-S4 cancellation takes precedence over all lifecycle transitions', () => {
    const status = deriveExecutionAttemptStatus({
      runtimeEnvelopeEligibility: 'eligible',
      runtimeEnvelopeState: 'ready_for_runtime',
      runtimeEnvelopeBlockers: [],
      runtimeEnvelopeLimitations: [],
      historyEntries: [{
        executionAttemptId: 'ea-1',
        runtimeEnvelopeId: 're-1',
        executionContractId: 'ec-1',
        missionId: 'm1',
        eventType: 'execution_attempt_cancelled',
        eventDedupeKey: 'k-cancelled',
        reasoning: 'cancelled',
        payload: {},
      }],
    });

    expect(status.attemptState).toBe('pending');
    expect(status.attemptLifecycleState).toBe('cancelled');
  });
});
