export type SchedulingStrategy =
  | 'topological_wave'
  | 'stable_priority';

export type RetryPriorityMode =
  | 'after_fresh_ready'
  | 'before_fresh_ready'
  | 'stable_mixed';

export type TaskConcurrencyPolicy = {
  policyId: string;
  maxConcurrentNodes: number;
  schedulingStrategy: SchedulingStrategy;
  retryPriorityMode: RetryPriorityMode;
  sameLevelParallelismAllowed: boolean;
  enabled: boolean;
};
