export const RUNTIME_OUTCOME_PROPAGATION_STATUS_VALUES = [
  'pending',
  'applied',
  'partially_applied',
  'deferred',
  'blocked',
  'failed',
  'inconclusive',
] as const;

export type RuntimeOutcomePropagationStatus = typeof RUNTIME_OUTCOME_PROPAGATION_STATUS_VALUES[number];
