import type { MissionActivationPolicy } from './mission-activation-policy-types.ts';
import type {
  ActivationMode,
  ActivationPreconditionResult,
  ActivationState,
  ExecutionReadinessState,
  MissionActivationHistoryEntry,
} from './mission-activation-types.ts';

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function hasHistoryEvent(entries: MissionActivationHistoryEntry[] | undefined, eventType: string): boolean {
  if (!entries) {
    return false;
  }
  return entries.some((entry) => entry.eventType === eventType);
}

function collectFromPreconditions(
  results: ActivationPreconditionResult[],
  field: 'blockingReasons' | 'limitations' | 'reasonTokens',
): string[] {
  return uniqueSorted(results.flatMap((entry) => entry[field]));
}

export function deriveExecutionReadinessState(input: {
  preconditionResults: ActivationPreconditionResult[];
  historyEntries?: MissionActivationHistoryEntry[];
}): ExecutionReadinessState {
  const states = input.preconditionResults.map((entry) => entry.state);

  if (hasHistoryEvent(input.historyEntries, 'activation_rejected')) {
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
      hasHistoryEvent(input.historyEntries, 'activation_confirmed')
      && input.preconditionResults.every((entry) => entry.category !== 'activation_confirmation' || entry.state === 'waiting')
      && input.preconditionResults.every((entry) => entry.state === 'waiting' || entry.state === 'satisfied')
    ) {
      return 'ready';
    }

    const waitingCategories = input.preconditionResults
      .filter((entry) => entry.state === 'waiting')
      .map((entry) => entry.category);

    if (waitingCategories.some((entry) => entry === 'activation_confirmation' || entry === 'assignment_confirmation')) {
      return 'waiting_on_confirmation';
    }

    return 'waiting_on_dependencies';
  }

  return 'ready';
}

export function deriveActivationState(input: {
  activationMode: ActivationMode;
  executionReadinessState: ExecutionReadinessState;
  blockingReasons: string[];
  policy: MissionActivationPolicy;
  historyEntries?: MissionActivationHistoryEntry[];
}): ActivationState {
  if (hasHistoryEvent(input.historyEntries, 'activation_rejected')) {
    return 'rejected';
  }

  if (input.executionReadinessState === 'blocked' || input.blockingReasons.length > 0) {
    return 'blocked';
  }

  if (input.activationMode === 'no_activation') {
    return 'blocked';
  }

  if (input.executionReadinessState === 'ready') {
    if (
      input.policy.requiresFounderActivationConfirmation
      && !hasHistoryEvent(input.historyEntries, 'activation_confirmed')
    ) {
      return 'under_review';
    }
    return 'ready_for_activation';
  }

  if (
    input.activationMode === 'manual_gate'
    || input.activationMode === 'founder_review_required'
    || input.executionReadinessState === 'waiting_on_confirmation'
  ) {
    return 'under_review';
  }

  return 'evaluated';
}

export function deriveMissionActivationStatus(input: {
  policy: MissionActivationPolicy;
  activationMode: ActivationMode;
  preconditionResults: ActivationPreconditionResult[];
  historyEntries?: MissionActivationHistoryEntry[];
}): {
  activationState: ActivationState;
  executionReadinessState: ExecutionReadinessState;
  blockingReasons: string[];
  limitations: string[];
  activationReasonTokens: string[];
} {
  const blockingReasons = collectFromPreconditions(input.preconditionResults, 'blockingReasons');
  const limitations = collectFromPreconditions(input.preconditionResults, 'limitations');
  const activationReasonTokens = collectFromPreconditions(input.preconditionResults, 'reasonTokens');

  const executionReadinessState = deriveExecutionReadinessState({
    preconditionResults: input.preconditionResults,
    historyEntries: input.historyEntries,
  });

  const activationState = deriveActivationState({
    activationMode: input.activationMode,
    executionReadinessState,
    blockingReasons,
    policy: input.policy,
    historyEntries: input.historyEntries,
  });

  const reasonTokens = uniqueSorted([
    ...activationReasonTokens,
    `activation_mode:${input.activationMode}`,
    `execution_readiness:${executionReadinessState}`,
    `activation_state:${activationState}`,
  ]);

  return {
    activationState,
    executionReadinessState,
    blockingReasons,
    limitations,
    activationReasonTokens: reasonTokens,
  };
}
