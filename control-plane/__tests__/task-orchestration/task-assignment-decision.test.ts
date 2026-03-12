import { describe, expect, it } from 'vitest';

import {
  getWorkerSchedulingPolicy,
  listWorkerSchedulingPolicies,
  deriveAssignmentDecisionId,
} from '../../task-execution/task-assignment-decision.ts';

describe('task assignment decision model', () => {
  it('T-MTO-AD1 seeded worker scheduling policies are deterministic', () => {
    const first = listWorkerSchedulingPolicies();
    const second = listWorkerSchedulingPolicies();

    expect(second).toEqual(first);
    expect(first.map((policy) => policy.policyId)).toEqual([
      'balanced-capacity-default',
      'retry-priority-default',
      'single-assignment-default',
      'stable-lexical-default',
    ]);
  });

  it('T-MTO-AD2 assignment decision id is deterministic', () => {
    const input = {
      executionRunId: 'er-1',
      taskNodeId: 'node-a',
      cycleIndex: 1,
      workerId: 'worker-a',
      policyId: getWorkerSchedulingPolicy('stable-lexical-default').policyId,
      assignmentState: 'assigned',
      selectionReasonTokens: ['deterministic_rank:0'],
      deferralReasonTokens: [],
    };

    expect(deriveAssignmentDecisionId(input)).toBe(deriveAssignmentDecisionId(input));
  });
});
