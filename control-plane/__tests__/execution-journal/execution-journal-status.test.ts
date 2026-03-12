import { describe, expect, it } from 'vitest';

import { deriveExecutionJournalStatus } from '../../execution-journal/execution-journal-status.ts';
import type { MissionExecutionAttempt } from '../../execution-attempt/execution-attempt-types.ts';

function buildAttempt(overrides: Partial<MissionExecutionAttempt> = {}): MissionExecutionAttempt {
  return {
    executionAttemptId: 'ea-1',
    runtimeEnvelopeId: 're-1',
    executionContractId: 'ec-1',
    missionId: 'm1',
    attemptIndex: 1,
    executionPolicyId: 'policy-1',
    attemptState: 'pending',
    attemptLifecycleState: 'created',
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
    limitations: [],
    blockers: [],
    provenanceInputs: {
      runtimeEnvelopeId: 're-1',
      executionContractId: 'ec-1',
      missionId: 'm1',
      executionPolicyId: 'policy-1',
      runtimeEnvelopeState: 'ready_for_runtime',
      runtimeEnvelopeEligibility: 'eligible',
      runtimeEnvelopeBlockers: [],
      runtimeEnvelopeLimitations: [],
    },
    ...overrides,
  };
}

describe('execution journal status', () => {
  it('T-MEJ-S1 derives initialized with one created event', () => {
    const status = deriveExecutionJournalStatus({
      executionAttempt: buildAttempt(),
      events: [{
        eventType: 'attempt_created',
        eventDedupeKey: 'k1',
        executionJournalId: 'ej-1',
        executionAttemptId: 'ea-1',
        eventIndex: 0,
        eventPayload: {},
        reasonTokens: ['created'],
        blockingReasons: [],
        limitations: [],
      }],
    });

    expect(status.journalState).toBe('initialized');
  });

  it('T-MEJ-S2 derives collecting with prepared but not ready', () => {
    const status = deriveExecutionJournalStatus({
      executionAttempt: buildAttempt({ attemptLifecycleState: 'prepared' }),
      events: [
        {
          eventType: 'attempt_created',
          eventDedupeKey: 'k1',
          executionJournalId: 'ej-1',
          executionAttemptId: 'ea-1',
          eventIndex: 0,
          eventPayload: {},
          reasonTokens: [],
          blockingReasons: [],
          limitations: [],
        },
        {
          eventType: 'attempt_prepared',
          eventDedupeKey: 'k2',
          executionJournalId: 'ej-1',
          executionAttemptId: 'ea-1',
          eventIndex: 1,
          eventPayload: {},
          reasonTokens: [],
          blockingReasons: [],
          limitations: [],
        },
      ],
    });

    expect(status.journalState).toBe('collecting');
  });

  it('T-MEJ-S3 derives ready_for_runtime_events when ready marker exists', () => {
    const status = deriveExecutionJournalStatus({
      executionAttempt: buildAttempt({ attemptLifecycleState: 'ready_for_execution' }),
      events: [
        {
          eventType: 'attempt_created',
          eventDedupeKey: 'k1',
          executionJournalId: 'ej-1',
          executionAttemptId: 'ea-1',
          eventIndex: 0,
          eventPayload: {},
          reasonTokens: [],
          blockingReasons: [],
          limitations: [],
        },
        {
          eventType: 'attempt_ready_for_execution',
          eventDedupeKey: 'k2',
          executionJournalId: 'ej-1',
          executionAttemptId: 'ea-1',
          eventIndex: 1,
          eventPayload: {},
          reasonTokens: [],
          blockingReasons: [],
          limitations: [],
        },
      ],
    });

    expect(status.journalState).toBe('ready_for_runtime_events');
  });

  it('T-MEJ-S4 derives blocked when attempt truth has blockers', () => {
    const status = deriveExecutionJournalStatus({
      executionAttempt: buildAttempt({ blockers: ['runtime_gate_blocked'] }),
      events: [],
    });

    expect(status.journalState).toBe('blocked');
    expect(status.blockers).toContain('runtime_gate_blocked');
  });

  it('T-MEJ-S5 derives limitation markers for incomplete and inconclusive states', () => {
    const incomplete = deriveExecutionJournalStatus({
      executionAttempt: buildAttempt({ attemptState: 'incomplete' }),
      events: [],
    });

    const inconclusive = deriveExecutionJournalStatus({
      executionAttempt: buildAttempt({ attemptState: 'inconclusive' }),
      events: [],
    });

    expect(incomplete.limitations).toContain('execution_journal_attempt_state_incomplete');
    expect(inconclusive.limitations).toContain('execution_journal_attempt_state_inconclusive');
  });
});
