export const RUNTIME_OUTCOME_PROPAGATION_OUTCOME_VALUES = [
  'no_change',
  'upstream_updated',
  'partially_updated',
  'blocked',
  'failed',
  'deferred',
  'inconclusive',
] as const;

export type RuntimeOutcomePropagationOutcome = typeof RUNTIME_OUTCOME_PROPAGATION_OUTCOME_VALUES[number];
