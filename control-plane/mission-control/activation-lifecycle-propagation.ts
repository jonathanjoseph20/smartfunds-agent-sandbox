import { deriveActivationLifecyclePropagationId, uniqueSortedStrings } from './runtime-outcome-propagation-identity.ts';
import type {
  ActivationLifecyclePropagation,
  ActivationLifecyclePropagationClass,
  RuntimeOutcomePropagationRecordState,
} from './runtime-outcome-propagation-types.ts';

export function deriveActivationLifecyclePropagationClass(input: { runtimeStatus: string }): ActivationLifecyclePropagationClass {
  if (input.runtimeStatus === 'runtime_completed') {
    return 'activation_completed';
  }
  if (input.runtimeStatus === 'runtime_failed') {
    return 'activation_failed';
  }
  if (input.runtimeStatus === 'runtime_deferred') {
    return 'activation_deferred';
  }
  if (input.runtimeStatus === 'inconclusive') {
    return 'activation_inconclusive';
  }
  return 'activation_retrying';
}

export function deriveActivationLifecyclePropagationState(input: {
  propagationClass: ActivationLifecyclePropagationClass;
}): RuntimeOutcomePropagationRecordState {
  if (input.propagationClass === 'activation_inconclusive') {
    return 'inconclusive';
  }
  if (input.propagationClass === 'activation_retrying') {
    return 'active';
  }
  return 'resolved';
}

export function createActivationLifecyclePropagation(input: {
  runtimeOutcomePropagationRecordId: string;
  executionActivationRecordId: string;
  runtimeStatus: string;
  reasonTokens?: string[];
}): ActivationLifecyclePropagation {
  const propagationClass = deriveActivationLifecyclePropagationClass({ runtimeStatus: input.runtimeStatus });
  const reasonTokens = uniqueSortedStrings([
    `runtime_status:${input.runtimeStatus}`,
    `propagation_class:${propagationClass}`,
    ...(input.reasonTokens ?? []),
  ]);

  return {
    activationLifecyclePropagationId: deriveActivationLifecyclePropagationId({
      runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
      executionActivationRecordId: input.executionActivationRecordId,
      propagationClass,
      reasonTokens,
    }),
    runtimeOutcomePropagationRecordId: input.runtimeOutcomePropagationRecordId,
    executionActivationRecordId: input.executionActivationRecordId,
    propagationClass,
    reasonTokens,
    state: deriveActivationLifecyclePropagationState({ propagationClass }),
  };
}
