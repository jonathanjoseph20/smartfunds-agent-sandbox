import type { MissionExecutionEngineHistoryEntry } from './execution-engine-types.ts';
import type { ExecutionEnginePolicy } from './execution-engine-policy-types.ts';
import type {
  ExecutionEngineEligibilityState,
  ExecutionEngineState,
} from './execution-engine-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasEvent(entries: MissionExecutionEngineHistoryEntry[] | undefined, eventType: string): boolean {
  if (!entries) {
    return false;
  }

  return entries.some((entry) => entry.eventType === eventType);
}

export function deriveExecutionEngineStatus(input: {
  policy: ExecutionEnginePolicy;
  attemptExists: boolean;
  attemptState: string;
  attemptLifecycleState: string;
  journalExists: boolean;
  journalState: string;
  runtimeEnvelopeState: string;
  runtimeEnvelopeEligibility: string;
  contractState: string;
  contractEligibilityState: string;
  founderEngineConfirmed: boolean;
  capabilityModelCompatible: boolean;
  historyEntries?: MissionExecutionEngineHistoryEntry[];
}): {
  engineState: ExecutionEngineState;
  engineEligibilityState: ExecutionEngineEligibilityState;
  blockingReasons: string[];
  limitations: string[];
} {
  const blockingReasons: string[] = [];
  const waitingOnSupport: string[] = [];
  const incompleteReasons: string[] = [];
  const inconclusiveReasons: string[] = [];

  if (!input.attemptExists) {
    blockingReasons.push('execution_attempt_not_found');
  }

  if (input.policy.requiresEligibleAttempt) {
    if (input.attemptState === 'blocked' || input.attemptLifecycleState === 'cancelled') {
      blockingReasons.push('execution_attempt_not_eligible');
    }
    if (input.attemptState === 'incomplete') {
      incompleteReasons.push('execution_attempt_incomplete');
    }
    if (input.attemptState === 'inconclusive') {
      inconclusiveReasons.push('execution_attempt_inconclusive');
    }
    if (input.attemptState === 'waiting_on_runtime_support') {
      waitingOnSupport.push('execution_attempt_waiting_on_runtime_support');
    }
  }

  if (!input.journalExists) {
    blockingReasons.push('execution_journal_not_found');
  } else if (input.policy.requiresReadyJournal) {
    if (input.journalState === 'blocked') {
      blockingReasons.push('execution_journal_blocked');
    } else if (input.journalState !== 'ready_for_runtime_events') {
      waitingOnSupport.push('execution_journal_not_ready');
    }
  }

  if (input.policy.requiresEligibleRuntimeEnvelope) {
    if (input.runtimeEnvelopeState === 'blocked' || input.runtimeEnvelopeEligibility === 'blocked') {
      blockingReasons.push('runtime_envelope_blocked');
    }
    if (input.runtimeEnvelopeEligibility === 'waiting_on_runtime_support') {
      waitingOnSupport.push('runtime_envelope_waiting_on_support');
    }
    if (input.runtimeEnvelopeEligibility === 'incomplete') {
      incompleteReasons.push('runtime_envelope_incomplete');
    }
    if (input.runtimeEnvelopeEligibility === 'inconclusive') {
      inconclusiveReasons.push('runtime_envelope_inconclusive');
    }
  }

  if (input.policy.requiresExecutionContractReady) {
    if (input.contractState === 'rejected' || input.contractState === 'blocked' || input.contractEligibilityState === 'blocked') {
      blockingReasons.push('execution_contract_blocked');
    }
    if (input.contractEligibilityState === 'incomplete') {
      incompleteReasons.push('execution_contract_incomplete');
    }
    if (input.contractEligibilityState === 'inconclusive') {
      inconclusiveReasons.push('execution_contract_inconclusive');
    }
  }

  if (input.policy.requiresFounderEngineConfirmation && !input.founderEngineConfirmed) {
    waitingOnSupport.push('founder_engine_confirmation_required');
  }

  if (!input.capabilityModelCompatible) {
    blockingReasons.push('engine_capability_model_incompatible');
  }

  let engineEligibilityState: ExecutionEngineEligibilityState = 'eligible';
  if (blockingReasons.length > 0) {
    engineEligibilityState = 'blocked';
  } else if (waitingOnSupport.length > 0) {
    engineEligibilityState = 'waiting_on_support';
  } else if (incompleteReasons.length > 0) {
    engineEligibilityState = 'incomplete';
  } else if (inconclusiveReasons.length > 0) {
    engineEligibilityState = 'inconclusive';
  }

  let engineState: ExecutionEngineState = engineEligibilityState === 'eligible'
    ? 'eligible_to_start'
    : 'initialized';

  if (hasEvent(input.historyEntries, 'engine_run_started')) {
    engineState = 'running';
  }
  if (hasEvent(input.historyEntries, 'engine_run_completed')) {
    engineState = 'completed';
  }
  if (hasEvent(input.historyEntries, 'engine_run_failed')) {
    engineState = 'failed';
  }
  if (hasEvent(input.historyEntries, 'engine_run_cancelled')) {
    engineState = 'cancelled';
  }

  const limitations = uniqueSorted([
    'execution_engine_bounded_layer_only',
    'execution_engine_projection_first_truth',
    'execution_engine_no_runtime_dispatch',
    input.policy.allowsLiveExecution ? '' : 'execution_engine_live_execution_disabled_by_policy',
    ...waitingOnSupport,
    ...incompleteReasons,
    ...inconclusiveReasons,
  ].filter((entry) => entry.length > 0));

  return {
    engineState,
    engineEligibilityState,
    blockingReasons: uniqueSorted(blockingReasons),
    limitations,
  };
}
