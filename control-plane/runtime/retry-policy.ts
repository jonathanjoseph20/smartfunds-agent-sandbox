export const RETRY_FAILURE_CODES = [
  'ADAPTER_EXECUTION_FAILED',
  'TOOL_TIMEOUT',
  'TASK_RESULT_INVALID',
  'NODE_TIMEOUT',
  'ADAPTER_TIMEOUT',
  'WORKFLOW_TIMEOUT'
] as const;

export type RetryFailureCode = (typeof RETRY_FAILURE_CODES)[number];

export type DeterministicBackoffStrategy = 'tick_linear';

export type RetryPolicy = {
  maxRetries: number;
  retryOn: RetryFailureCode[];
  backoffStrategy: DeterministicBackoffStrategy;
  immediateFirstRetry?: boolean;
};

export type RetryEvaluation = {
  eligible: boolean;
  reason:
    | 'RETRY_ELIGIBLE'
    | 'RETRY_EXHAUSTED'
    | 'FAILURE_CODE_NOT_RETRYABLE'
    | 'INVALID_ATTEMPT_INDEX';
  retryAttempt: number;
  tickDelay: number;
  exhausted: boolean;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  retryOn: [...RETRY_FAILURE_CODES],
  backoffStrategy: 'tick_linear',
  immediateFirstRetry: true
};

export function isRetryFailureCode(value: string): value is RetryFailureCode {
  return (RETRY_FAILURE_CODES as readonly string[]).includes(value);
}

export function nextRetryAttemptIndex(previousRetryCount: number): number {
  if (!Number.isInteger(previousRetryCount) || previousRetryCount < 0) {
    return -1;
  }

  return previousRetryCount + 1;
}

export function getDeterministicTickDelay(retryAttempt: number): number {
  if (retryAttempt <= 1) {
    return 0;
  }

  return retryAttempt - 1;
}

export function evaluateRetryPolicy(input: {
  policy?: RetryPolicy;
  failureCode: RetryFailureCode;
  previousRetryCount: number;
}): RetryEvaluation {
  const policy = input.policy ?? DEFAULT_RETRY_POLICY;
  const retryAttempt = nextRetryAttemptIndex(input.previousRetryCount);

  if (retryAttempt <= 0) {
    return {
      eligible: false,
      reason: 'INVALID_ATTEMPT_INDEX',
      retryAttempt,
      tickDelay: 0,
      exhausted: false
    };
  }

  if (!policy.retryOn.includes(input.failureCode)) {
    return {
      eligible: false,
      reason: 'FAILURE_CODE_NOT_RETRYABLE',
      retryAttempt,
      tickDelay: 0,
      exhausted: false
    };
  }

  if (retryAttempt > policy.maxRetries) {
    return {
      eligible: false,
      reason: 'RETRY_EXHAUSTED',
      retryAttempt,
      tickDelay: 0,
      exhausted: true
    };
  }

  return {
    eligible: true,
    reason: 'RETRY_ELIGIBLE',
    retryAttempt,
    tickDelay: getDeterministicTickDelay(retryAttempt),
    exhausted: retryAttempt >= policy.maxRetries
  };
}
