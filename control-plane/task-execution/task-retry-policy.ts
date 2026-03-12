import type { TaskFailureClass } from './task-failure-classifier.ts';

export const TASK_RETRY_STRATEGIES = [
  'immediate',
] as const;

export const TASK_RETRY_DELAY_MODELS = [
  'immediate',
  'deterministic_linear',
  'deterministic_exponential',
] as const;

export type TaskRetryStrategy = typeof TASK_RETRY_STRATEGIES[number];
export type TaskRetryDelayModel = typeof TASK_RETRY_DELAY_MODELS[number];

export interface MissionTaskRetryPolicy {
  retryPolicyId: string;
  maxRetries: number;
  retryStrategy: TaskRetryStrategy;
  retryDelayModel: TaskRetryDelayModel;
  retryConditions: TaskFailureClass[];
  baseDelay: number;
}

export const DEFAULT_MISSION_TASK_RETRY_POLICY: MissionTaskRetryPolicy = {
  retryPolicyId: 'mission_task_retry_default_v1',
  maxRetries: 3,
  retryStrategy: 'immediate',
  retryDelayModel: 'deterministic_linear',
  retryConditions: ['RETRYABLE_FAILURE', 'SYSTEM_FAILURE'],
  baseDelay: 1,
};

function uniqueSorted(values: TaskFailureClass[]): TaskFailureClass[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

export function normalizeMissionTaskRetryPolicy(policy?: Partial<MissionTaskRetryPolicy>): MissionTaskRetryPolicy {
  const merged: MissionTaskRetryPolicy = {
    ...DEFAULT_MISSION_TASK_RETRY_POLICY,
    ...(policy ?? {}),
  };

  return {
    retryPolicyId: merged.retryPolicyId,
    maxRetries: Number.isInteger(merged.maxRetries) && merged.maxRetries >= 0
      ? merged.maxRetries
      : DEFAULT_MISSION_TASK_RETRY_POLICY.maxRetries,
    retryStrategy: merged.retryStrategy,
    retryDelayModel: merged.retryDelayModel,
    retryConditions: uniqueSorted(merged.retryConditions),
    baseDelay: Number.isInteger(merged.baseDelay) && merged.baseDelay >= 0
      ? merged.baseDelay
      : DEFAULT_MISSION_TASK_RETRY_POLICY.baseDelay,
  };
}

export function deriveDeterministicRetryDelay(input: {
  retryDelayModel: TaskRetryDelayModel;
  baseDelay: number;
  attemptIndex: number;
}): number {
  if (input.attemptIndex <= 0) {
    return 0;
  }

  if (input.retryDelayModel === 'immediate') {
    return 0;
  }

  if (input.retryDelayModel === 'deterministic_exponential') {
    return input.baseDelay * (2 ** (input.attemptIndex - 1));
  }

  return input.baseDelay * input.attemptIndex;
}

export function evaluateTaskRetryEligibility(input: {
  policy?: Partial<MissionTaskRetryPolicy>;
  failureClass: TaskFailureClass;
  currentRetryCount: number;
}): {
  policy: MissionTaskRetryPolicy;
  eligible: boolean;
  reason: 'RETRY_ELIGIBLE' | 'RETRY_LIMIT_EXCEEDED' | 'FAILURE_CLASS_NOT_RETRYABLE' | 'INVALID_RETRY_COUNT';
  attemptIndex: number;
  retryCount: number;
  retryDelay: number;
} {
  const policy = normalizeMissionTaskRetryPolicy(input.policy);

  if (!Number.isInteger(input.currentRetryCount) || input.currentRetryCount < 0) {
    return {
      policy,
      eligible: false,
      reason: 'INVALID_RETRY_COUNT',
      attemptIndex: -1,
      retryCount: input.currentRetryCount,
      retryDelay: 0,
    };
  }

  const attemptIndex = input.currentRetryCount + 1;

  if (!policy.retryConditions.includes(input.failureClass)) {
    return {
      policy,
      eligible: false,
      reason: 'FAILURE_CLASS_NOT_RETRYABLE',
      attemptIndex,
      retryCount: input.currentRetryCount,
      retryDelay: 0,
    };
  }

  if (attemptIndex > policy.maxRetries) {
    return {
      policy,
      eligible: false,
      reason: 'RETRY_LIMIT_EXCEEDED',
      attemptIndex,
      retryCount: input.currentRetryCount,
      retryDelay: 0,
    };
  }

  return {
    policy,
    eligible: true,
    reason: 'RETRY_ELIGIBLE',
    attemptIndex,
    retryCount: attemptIndex,
    retryDelay: deriveDeterministicRetryDelay({
      retryDelayModel: policy.retryDelayModel,
      baseDelay: policy.baseDelay,
      attemptIndex,
    }),
  };
}
