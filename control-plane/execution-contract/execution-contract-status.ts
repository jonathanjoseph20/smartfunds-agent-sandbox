import type { ExecutionContractPolicy } from './execution-contract-policy-types.ts';
import type {
  ExecutionContractPreconditionResult,
  ExecutionContractState,
  ExecutionEligibilityState,
  MissionExecutionContractHistoryEntry,
} from './execution-contract-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasHistoryEvent(entries: MissionExecutionContractHistoryEntry[] | undefined, eventType: string): boolean {
  if (!entries) {
    return false;
  }
  return entries.some((entry) => entry.eventType === eventType);
}

function collectFromPreconditions(
  results: ExecutionContractPreconditionResult[],
  field: 'blockingReasons' | 'limitations' | 'reasonTokens',
): string[] {
  return uniqueSorted(results.flatMap((entry) => entry[field]));
}

export function deriveExecutionEligibilityState(input: {
  preconditionResults: ExecutionContractPreconditionResult[];
  historyEntries?: MissionExecutionContractHistoryEntry[];
}): ExecutionEligibilityState {
  const states = input.preconditionResults.map((entry) => entry.state);

  if (hasHistoryEvent(input.historyEntries, 'execution_contract_rejected')) {
    return 'blocked';
  }

  if (states.some((state) => state === 'blocked')) {
    return 'blocked';
  }
  if (states.some((state) => state === 'inconclusive')) {
    return 'inconclusive';
  }
  if (states.some((state) => state === 'incomplete')) {
    return 'incomplete';
  }
  if (states.some((state) => state === 'waiting')) {
    if (
      hasHistoryEvent(input.historyEntries, 'execution_contract_confirmed')
      && input.preconditionResults.every((entry) => entry.preconditionId !== 'runtime_governance' || entry.state === 'waiting')
      && input.preconditionResults.every((entry) => entry.state === 'waiting' || entry.state === 'satisfied')
    ) {
      return 'eligible';
    }

    return 'waiting_on_runtime_preparation';
  }

  return 'eligible';
}

export function deriveExecutionContractState(input: {
  policy: ExecutionContractPolicy;
  executionEligibilityState: ExecutionEligibilityState;
  blockingReasons: string[];
  preconditionResults: ExecutionContractPreconditionResult[];
  historyEntries?: MissionExecutionContractHistoryEntry[];
}): ExecutionContractState {
  if (hasHistoryEvent(input.historyEntries, 'execution_contract_rejected')) {
    return 'rejected';
  }

  if (input.executionEligibilityState === 'blocked' || input.blockingReasons.length > 0) {
    return 'blocked';
  }

  const runtimeGovernancePrecondition = input.preconditionResults.find((entry) => entry.preconditionId === 'runtime_governance');
  const waitingOnRuntimeGovernance = runtimeGovernancePrecondition?.state === 'waiting';

  if (waitingOnRuntimeGovernance) {
    if (input.policy.requiresFounderRuntimeApproval && hasHistoryEvent(input.historyEntries, 'execution_contract_confirmed')) {
      return 'ready_for_runtime_handoff';
    }
    return 'under_review';
  }

  if (input.executionEligibilityState === 'eligible') {
    return 'ready_for_runtime_handoff';
  }

  return 'evaluated';
}

export function deriveExecutionContractStatus(input: {
  policy: ExecutionContractPolicy;
  preconditionResults: ExecutionContractPreconditionResult[];
  historyEntries?: MissionExecutionContractHistoryEntry[];
}): {
  contractState: ExecutionContractState;
  executionEligibilityState: ExecutionEligibilityState;
  blockingReasons: string[];
  limitations: string[];
  reasonTokens: string[];
} {
  const blockingReasons = collectFromPreconditions(input.preconditionResults, 'blockingReasons');
  const limitations = collectFromPreconditions(input.preconditionResults, 'limitations');
  const preconditionReasonTokens = collectFromPreconditions(input.preconditionResults, 'reasonTokens');

  const executionEligibilityState = deriveExecutionEligibilityState({
    preconditionResults: input.preconditionResults,
    historyEntries: input.historyEntries,
  });

  const contractState = deriveExecutionContractState({
    policy: input.policy,
    executionEligibilityState,
    blockingReasons,
    preconditionResults: input.preconditionResults,
    historyEntries: input.historyEntries,
  });

  const reasonTokens = uniqueSorted([
    ...preconditionReasonTokens,
    `execution_eligibility:${executionEligibilityState}`,
    `contract_state:${contractState}`,
  ]);

  return {
    contractState,
    executionEligibilityState,
    blockingReasons,
    limitations,
    reasonTokens,
  };
}
