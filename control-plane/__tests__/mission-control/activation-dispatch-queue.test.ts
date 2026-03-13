import { describe, expect, it } from 'vitest';

import { createActivationDispatchAttempt } from '../../mission-control/activation-dispatch-attempt.ts';
import { deriveActivationDispatchQueueEntry, sortActivationDispatchQueue } from '../../mission-control/activation-dispatch-queue.ts';
import type { ExecutionActivationRecord } from '../../mission-control/mission-execution-activation-types.ts';

function activationRecord(id: string, priority: string): ExecutionActivationRecord {
  return {
    executionActivationRecordId: id,
    executionRequestRecordId: `request-${id}`,
    missionExecutionCoordinationPlanId: 'plan-1',
    executionIntentId: 'intent-1',
    targetExecutionDomain: 'mission_execution',
    priority,
    state: 'queued',
    outcome: 'pending',
  };
}

describe('activation dispatch queue', () => {
  it('T-ARI-Q1 deterministic ordering is priority then attempt identity', () => {
    const low = createActivationDispatchAttempt({ activationRecord: activationRecord('activation-low', 'low') });
    const high = createActivationDispatchAttempt({ activationRecord: activationRecord('activation-high', 'high') });

    const entries = sortActivationDispatchQueue([
      deriveActivationDispatchQueueEntry({ dispatchAttempt: low, runtimeLinks: [], feedbackRecords: [], historyEntries: [] }),
      deriveActivationDispatchQueueEntry({ dispatchAttempt: high, runtimeLinks: [], feedbackRecords: [], historyEntries: [] }),
    ]);

    expect(entries[0]?.activationDispatchAttemptId).toBe(high.activationDispatchAttemptId);
  });

  it('T-ARI-Q2 replay-stable history events drive queue posture deterministically', () => {
    const attempt = createActivationDispatchAttempt({ activationRecord: activationRecord('activation-1', 'high') });

    const entry = deriveActivationDispatchQueueEntry({
      dispatchAttempt: attempt,
      runtimeLinks: [],
      feedbackRecords: [],
      historyEntries: [{
        activationDispatchAttemptId: attempt.activationDispatchAttemptId,
        eventType: 'activation_dispatch_submitted',
        eventDedupeKey: '1',
        reasonTokens: [],
        payload: {},
      }],
    });

    expect(entry.queueState).toBe('dispatch_submitted');
  });
});
