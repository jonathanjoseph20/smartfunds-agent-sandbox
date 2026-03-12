import { describe, expect, it } from 'vitest';

import { getExecutionContractPolicy } from '../../execution-contract/execution-contract-policies.ts';
import { deriveExecutionContractStatus } from '../../execution-contract/execution-contract-status.ts';
import type { ExecutionContractPreconditionResult } from '../../execution-contract/execution-contract-types.ts';

function precondition(overrides: Partial<ExecutionContractPreconditionResult>): ExecutionContractPreconditionResult {
  return {
    preconditionId: 'mission_exists',
    category: 'mission',
    state: 'satisfied',
    reasonTokens: [],
    blockingReasons: [],
    limitations: [],
    ...overrides,
  };
}

describe('execution contract status', () => {
  it('T-MEC-S1 derives ready_for_runtime_handoff when all preconditions are satisfied', () => {
    const status = deriveExecutionContractStatus({
      policy: getExecutionContractPolicy('operator-reviewed-contract'),
      preconditionResults: [
        precondition({ preconditionId: 'mission_exists', category: 'mission', state: 'satisfied' }),
        precondition({ preconditionId: 'runtime_governance', category: 'runtime_governance', state: 'satisfied' }),
      ],
    });

    expect(status.executionEligibilityState).toBe('eligible');
    expect(status.contractState).toBe('ready_for_runtime_handoff');
  });

  it('T-MEC-S2 derives under_review when waiting on runtime governance approval', () => {
    const status = deriveExecutionContractStatus({
      policy: getExecutionContractPolicy('strict-runtime-handoff-default'),
      preconditionResults: [
        precondition({ preconditionId: 'mission_exists', category: 'mission', state: 'satisfied' }),
        precondition({ preconditionId: 'runtime_governance', category: 'runtime_governance', state: 'waiting' }),
      ],
    });

    expect(status.executionEligibilityState).toBe('waiting_on_runtime_preparation');
    expect(status.contractState).toBe('under_review');
  });

  it('T-MEC-S3 derives blocked when blocker is present', () => {
    const status = deriveExecutionContractStatus({
      policy: getExecutionContractPolicy('operator-reviewed-contract'),
      preconditionResults: [
        precondition({
          preconditionId: 'team_available',
          category: 'team',
          state: 'blocked',
          blockingReasons: ['selected_team_unavailable'],
        }),
      ],
    });

    expect(status.executionEligibilityState).toBe('blocked');
    expect(status.contractState).toBe('blocked');
  });

  it('T-MEC-S4 derives rejected from explicit rejection history event', () => {
    const status = deriveExecutionContractStatus({
      policy: getExecutionContractPolicy('strict-runtime-handoff-default'),
      preconditionResults: [
        precondition({ preconditionId: 'runtime_governance', category: 'runtime_governance', state: 'waiting' }),
      ],
      historyEntries: [{
        executionContractId: 'ec-1',
        missionId: 'm1',
        eventType: 'execution_contract_rejected',
        eventDedupeKey: 'k1',
        reasoning: 'rejected',
        payload: {},
      }],
    });

    expect(status.contractState).toBe('rejected');
    expect(status.executionEligibilityState).toBe('blocked');
  });

  it('T-MEC-S5 derives eligible and ready_for_runtime_handoff after explicit confirmation event', () => {
    const status = deriveExecutionContractStatus({
      policy: getExecutionContractPolicy('strict-runtime-handoff-default'),
      preconditionResults: [
        precondition({ preconditionId: 'mission_exists', category: 'mission', state: 'satisfied' }),
        precondition({ preconditionId: 'runtime_governance', category: 'runtime_governance', state: 'waiting' }),
      ],
      historyEntries: [{
        executionContractId: 'ec-1',
        missionId: 'm1',
        eventType: 'execution_contract_confirmed',
        eventDedupeKey: 'k-confirmed',
        reasoning: 'confirmed',
        payload: {},
      }],
    });

    expect(status.executionEligibilityState).toBe('eligible');
    expect(status.contractState).toBe('ready_for_runtime_handoff');
  });
});
