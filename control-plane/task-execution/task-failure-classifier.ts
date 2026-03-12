export const TASK_FAILURE_CLASSES = [
  'RETRYABLE_FAILURE',
  'NON_RETRYABLE_FAILURE',
  'SYSTEM_FAILURE',
  'POLICY_FAILURE',
  'DEPENDENCY_FAILURE',
] as const;

export type TaskFailureClass = typeof TASK_FAILURE_CLASSES[number];

export type TaskFailureClassifierPolicy = {
  policyId: string;
  mappings: Record<string, TaskFailureClass>;
  fallbackClass: TaskFailureClass;
};

export const DEFAULT_TASK_FAILURE_CLASSIFIER_POLICY: TaskFailureClassifierPolicy = {
  policyId: 'task_failure_classifier_v1',
  mappings: {
    TEMPORARY_TOOL_ERROR: 'RETRYABLE_FAILURE',
    TOOL_TIMEOUT: 'RETRYABLE_FAILURE',
    ADAPTER_TIMEOUT: 'RETRYABLE_FAILURE',
    TRANSIENT_RUNTIME_ERROR: 'RETRYABLE_FAILURE',
    INVALID_INPUT: 'NON_RETRYABLE_FAILURE',
    VALIDATION_ERROR: 'NON_RETRYABLE_FAILURE',
    NON_RETRYABLE_INPUT_ERROR: 'NON_RETRYABLE_FAILURE',
    POLICY_VIOLATION: 'POLICY_FAILURE',
    GOVERNANCE_POLICY_BLOCK: 'POLICY_FAILURE',
    DEPENDENCY_FAILED: 'DEPENDENCY_FAILURE',
    UPSTREAM_PERMANENT_FAILURE: 'DEPENDENCY_FAILURE',
    INTERNAL_SYSTEM_ERROR: 'SYSTEM_FAILURE',
    SYSTEM_RESOURCE_FAILURE: 'SYSTEM_FAILURE',
  },
  fallbackClass: 'NON_RETRYABLE_FAILURE',
};

function normalizeCode(value: string | undefined): string {
  return (value ?? '').trim().toUpperCase();
}

function assertFailureClass(value: string): TaskFailureClass {
  if (!(TASK_FAILURE_CLASSES as readonly string[]).includes(value)) {
    throw new Error('TASK_FAILURE_CLASS_INVALID');
  }

  return value as TaskFailureClass;
}

export function classifyTaskFailure(input: {
  failureCode?: string;
  explicitFailureClass?: TaskFailureClass;
  policy?: TaskFailureClassifierPolicy;
}): {
  failureClass: TaskFailureClass;
  classifierPolicyId: string;
  normalizedFailureCode: string;
} {
  const policy = input.policy ?? DEFAULT_TASK_FAILURE_CLASSIFIER_POLICY;
  const normalizedFailureCode = normalizeCode(input.failureCode);

  if (input.explicitFailureClass) {
    return {
      failureClass: assertFailureClass(input.explicitFailureClass),
      classifierPolicyId: policy.policyId,
      normalizedFailureCode,
    };
  }

  const mapped = normalizedFailureCode.length > 0
    ? policy.mappings[normalizedFailureCode]
    : undefined;

  return {
    failureClass: mapped ?? policy.fallbackClass,
    classifierPolicyId: policy.policyId,
    normalizedFailureCode,
  };
}
