import { describe, expect, it } from 'vitest';

import { createActivationDispatchAttempt } from '../../mission-control/activation-dispatch-attempt.ts';
import { deriveActivationRuntimeLinks } from '../../mission-control/activation-runtime-link.ts';
import type { ExecutionActivationRecord } from '../../mission-control/mission-execution-activation-types.ts';

const activationRecord: ExecutionActivationRecord = {
  executionActivationRecordId: 'activation-1',
  executionRequestRecordId: 'request-1',
  missionExecutionCoordinationPlanId: 'plan-1',
  executionIntentId: 'intent-1',
  targetExecutionDomain: 'mission_execution',
  priority: 'high',
  state: 'submitted',
  outcome: 'submitted',
};

describe('activation runtime link', () => {
  it('T-ARI-L1 runtime linkage dedupes deterministically and preserves IDs', () => {
    const attempt = createActivationDispatchAttempt({ activationRecord });

    const links = deriveActivationRuntimeLinks({
      dispatchAttempts: [attempt],
      linkRecords: [
        {
          activationDispatchAttemptId: attempt.activationDispatchAttemptId,
          executionAttemptId: 'exec-attempt-1',
          taskExecutionRunId: 'run-1',
          workerResultId: 'worker-1',
          runtimeLinkClass: 'runtime_started',
        },
        {
          activationDispatchAttemptId: attempt.activationDispatchAttemptId,
          executionAttemptId: 'exec-attempt-1',
          taskExecutionRunId: 'run-1',
          workerResultId: 'worker-1',
          runtimeLinkClass: 'runtime_started',
        },
      ],
    });

    expect(links).toHaveLength(1);
    expect(links[0]?.executionAttemptId).toBe('exec-attempt-1');
  });
});
