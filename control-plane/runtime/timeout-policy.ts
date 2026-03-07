export type TimeoutCode = 'NODE_TIMEOUT' | 'ADAPTER_TIMEOUT' | 'WORKFLOW_TIMEOUT';

export type TimeoutPolicy = {
  nodeTimeoutSeconds: number;
  adapterTimeoutSeconds: number;
  workflowTimeoutSeconds: number;
};

export type TimeoutViolation = {
  timedOut: boolean;
  code: TimeoutCode | null;
  reason: 'WITHIN_LIMIT' | 'LIMIT_EXCEEDED' | 'INVALID_CONFIGURATION';
  thresholdSeconds: number | null;
  elapsedSeconds: number;
};

export const DEFAULT_TIMEOUT_POLICY: TimeoutPolicy = {
  nodeTimeoutSeconds: 900,
  adapterTimeoutSeconds: 300,
  workflowTimeoutSeconds: 3600
};

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

export function validateTimeoutPolicy(policy: TimeoutPolicy): string[] {
  const errors: string[] = [];

  if (!isPositiveInteger(policy.nodeTimeoutSeconds)) {
    errors.push('Invalid timeout config: nodeTimeoutSeconds must be a positive integer.');
  }
  if (!isPositiveInteger(policy.adapterTimeoutSeconds)) {
    errors.push('Invalid timeout config: adapterTimeoutSeconds must be a positive integer.');
  }
  if (!isPositiveInteger(policy.workflowTimeoutSeconds)) {
    errors.push('Invalid timeout config: workflowTimeoutSeconds must be a positive integer.');
  }

  return errors.sort((left, right) => left.localeCompare(right));
}

function evaluateLimit(elapsedSeconds: number, limitSeconds: number, code: TimeoutCode): TimeoutViolation {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || !Number.isFinite(limitSeconds) || limitSeconds <= 0) {
    return {
      timedOut: false,
      code: null,
      reason: 'INVALID_CONFIGURATION',
      thresholdSeconds: null,
      elapsedSeconds
    };
  }

  if (elapsedSeconds > limitSeconds) {
    return {
      timedOut: true,
      code,
      reason: 'LIMIT_EXCEEDED',
      thresholdSeconds: limitSeconds,
      elapsedSeconds
    };
  }

  return {
    timedOut: false,
    code: null,
    reason: 'WITHIN_LIMIT',
    thresholdSeconds: limitSeconds,
    elapsedSeconds
  };
}

export function evaluateNodeTimeout(elapsedSeconds: number, policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY): TimeoutViolation {
  return evaluateLimit(elapsedSeconds, policy.nodeTimeoutSeconds, 'NODE_TIMEOUT');
}

export function evaluateAdapterTimeout(elapsedSeconds: number, policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY): TimeoutViolation {
  return evaluateLimit(elapsedSeconds, policy.adapterTimeoutSeconds, 'ADAPTER_TIMEOUT');
}

export function evaluateWorkflowTimeout(elapsedSeconds: number, policy: TimeoutPolicy = DEFAULT_TIMEOUT_POLICY): TimeoutViolation {
  return evaluateLimit(elapsedSeconds, policy.workflowTimeoutSeconds, 'WORKFLOW_TIMEOUT');
}
