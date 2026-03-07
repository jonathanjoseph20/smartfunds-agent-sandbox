export const SAFETY_LIMIT_CODES = {
  NODE_LIMIT_EXCEEDED: 'NODE_LIMIT_EXCEEDED',
  WORKFLOW_RUNTIME_EXCEEDED: 'WORKFLOW_RUNTIME_EXCEEDED',
  RETRIES_PER_NODE_EXCEEDED: 'RETRIES_PER_NODE_EXCEEDED',
  TOTAL_RETRIES_EXCEEDED: 'TOTAL_RETRIES_EXCEEDED',
  CONTEXT_SIZE_EXCEEDED: 'CONTEXT_SIZE_EXCEEDED'
} as const;

export type SafetyLimitCode = (typeof SAFETY_LIMIT_CODES)[keyof typeof SAFETY_LIMIT_CODES];

export type RuntimeSafetyLimits = {
  maxNodesPerWorkflow: number;
  maxWorkflowRuntimeSeconds: number;
  maxRetriesPerNode: number;
  maxTotalRetriesPerWorkflow: number;
  maxContextSize: number;
};

export type SafetyLimitViolation = {
  code: SafetyLimitCode;
  message: string;
  actual: number;
  limit: number;
};

export const DEFAULT_RUNTIME_SAFETY_LIMITS: RuntimeSafetyLimits = {
  maxNodesPerWorkflow: 50,
  maxWorkflowRuntimeSeconds: 3600,
  maxRetriesPerNode: 3,
  maxTotalRetriesPerWorkflow: 25,
  maxContextSize: 100_000
};

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

export function validateRuntimeSafetyLimits(limits: RuntimeSafetyLimits): string[] {
  const errors: string[] = [];

  if (!isPositiveInteger(limits.maxNodesPerWorkflow)) {
    errors.push('Invalid safety limits: maxNodesPerWorkflow must be a positive integer.');
  }
  if (!isPositiveInteger(limits.maxWorkflowRuntimeSeconds)) {
    errors.push('Invalid safety limits: maxWorkflowRuntimeSeconds must be a positive integer.');
  }
  if (!isPositiveInteger(limits.maxRetriesPerNode)) {
    errors.push('Invalid safety limits: maxRetriesPerNode must be a positive integer.');
  }
  if (!isPositiveInteger(limits.maxTotalRetriesPerWorkflow)) {
    errors.push('Invalid safety limits: maxTotalRetriesPerWorkflow must be a positive integer.');
  }
  if (!isPositiveInteger(limits.maxContextSize)) {
    errors.push('Invalid safety limits: maxContextSize must be a positive integer.');
  }

  return errors.sort((left, right) => left.localeCompare(right));
}

function violation(code: SafetyLimitCode, message: string, actual: number, limit: number): SafetyLimitViolation {
  return { code, message, actual, limit };
}

export function evaluateRuntimeSafetyLimits(input: {
  nodeCount: number;
  runtimeSeconds: number;
  retriesByNode: Record<string, number>;
  totalRetries: number;
  contextSize: number;
  limits?: RuntimeSafetyLimits;
}): SafetyLimitViolation[] {
  const limits = input.limits ?? DEFAULT_RUNTIME_SAFETY_LIMITS;
  const violations: SafetyLimitViolation[] = [];

  if (input.nodeCount > limits.maxNodesPerWorkflow) {
    violations.push(violation(
      SAFETY_LIMIT_CODES.NODE_LIMIT_EXCEEDED,
      `Safety limit exceeded: nodeCount=${input.nodeCount} maxNodesPerWorkflow=${limits.maxNodesPerWorkflow}`,
      input.nodeCount,
      limits.maxNodesPerWorkflow
    ));
  }

  if (input.runtimeSeconds > limits.maxWorkflowRuntimeSeconds) {
    violations.push(violation(
      SAFETY_LIMIT_CODES.WORKFLOW_RUNTIME_EXCEEDED,
      `Safety limit exceeded: runtimeSeconds=${input.runtimeSeconds} maxWorkflowRuntimeSeconds=${limits.maxWorkflowRuntimeSeconds}`,
      input.runtimeSeconds,
      limits.maxWorkflowRuntimeSeconds
    ));
  }

  const nodeIds = Object.keys(input.retriesByNode).sort((left, right) => left.localeCompare(right));
  for (const nodeId of nodeIds) {
    const retries = input.retriesByNode[nodeId] ?? 0;
    if (retries > limits.maxRetriesPerNode) {
      violations.push(violation(
        SAFETY_LIMIT_CODES.RETRIES_PER_NODE_EXCEEDED,
        `Safety limit exceeded: nodeId=${nodeId} retries=${retries} maxRetriesPerNode=${limits.maxRetriesPerNode}`,
        retries,
        limits.maxRetriesPerNode
      ));
    }
  }

  if (input.totalRetries > limits.maxTotalRetriesPerWorkflow) {
    violations.push(violation(
      SAFETY_LIMIT_CODES.TOTAL_RETRIES_EXCEEDED,
      `Safety limit exceeded: totalRetries=${input.totalRetries} maxTotalRetriesPerWorkflow=${limits.maxTotalRetriesPerWorkflow}`,
      input.totalRetries,
      limits.maxTotalRetriesPerWorkflow
    ));
  }

  if (input.contextSize > limits.maxContextSize) {
    violations.push(violation(
      SAFETY_LIMIT_CODES.CONTEXT_SIZE_EXCEEDED,
      `Safety limit exceeded: contextSize=${input.contextSize} maxContextSize=${limits.maxContextSize}`,
      input.contextSize,
      limits.maxContextSize
    ));
  }

  return violations.sort((left, right) => {
    const codeCmp = left.code.localeCompare(right.code);
    if (codeCmp !== 0) {
      return codeCmp;
    }
    return left.message.localeCompare(right.message);
  });
}
