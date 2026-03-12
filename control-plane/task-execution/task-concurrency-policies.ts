import type { TaskConcurrencyPolicy } from './task-concurrency-policy-types.ts';

export const SINGLE_LANE_DEFAULT: TaskConcurrencyPolicy = {
  policyId: 'single-lane-default',
  maxConcurrentNodes: 1,
  schedulingStrategy: 'topological_wave',
  retryPriorityMode: 'after_fresh_ready',
  sameLevelParallelismAllowed: false,
  enabled: true,
};

export const PARALLEL_WAVE_DEFAULT: TaskConcurrencyPolicy = {
  policyId: 'parallel-wave-default',
  maxConcurrentNodes: 4,
  schedulingStrategy: 'topological_wave',
  retryPriorityMode: 'after_fresh_ready',
  sameLevelParallelismAllowed: true,
  enabled: true,
};

export const STABLE_PRIORITY_LIMITED: TaskConcurrencyPolicy = {
  policyId: 'stable-priority-limited',
  maxConcurrentNodes: 2,
  schedulingStrategy: 'stable_priority',
  retryPriorityMode: 'stable_mixed',
  sameLevelParallelismAllowed: true,
  enabled: true,
};

export const RETRY_CONSERVATIVE_PARALLELISM: TaskConcurrencyPolicy = {
  policyId: 'retry-conservative-parallelism',
  maxConcurrentNodes: 2,
  schedulingStrategy: 'topological_wave',
  retryPriorityMode: 'after_fresh_ready',
  sameLevelParallelismAllowed: true,
  enabled: true,
};

const SEEDED_POLICIES: TaskConcurrencyPolicy[] = [
  SINGLE_LANE_DEFAULT,
  PARALLEL_WAVE_DEFAULT,
  STABLE_PRIORITY_LIMITED,
  RETRY_CONSERVATIVE_PARALLELISM,
];

export const DEFAULT_TASK_CONCURRENCY_POLICY_ID = PARALLEL_WAVE_DEFAULT.policyId;

export function listTaskConcurrencyPolicies(): TaskConcurrencyPolicy[] {
  return [...SEEDED_POLICIES].sort((left, right) => left.policyId.localeCompare(right.policyId));
}

export function getTaskConcurrencyPolicy(policyId: string): TaskConcurrencyPolicy {
  const policy = SEEDED_POLICIES.find((entry) => entry.policyId === policyId);
  if (!policy) {
    throw new Error(`TASK_CONCURRENCY_POLICY_NOT_FOUND: ${policyId}`);
  }

  return policy;
}
