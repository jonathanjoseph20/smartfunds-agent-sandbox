export type SupportedGithubEventType = 'check_run' | 'workflow_run';

export type FailureClass =
  | 'governance_failure'
  | 'unit_test_failure'
  | 'integration_test_failure'
  | 'lint_failure'
  | 'schema_failure'
  | 'rail_enforcement_failure'
  | 'unknown_failure';

export type EnvelopeConclusion = 'success' | 'failure' | 'neutral' | 'cancelled' | 'timed_out';

export interface CiFailureEnvelope {
  envelopeVersion: 1;
  eventType: SupportedGithubEventType;
  githubDeliveryId: string;
  repository: string;
  prNumber: number | null;
  headSha: string;
  checkName: string;
  conclusion: EnvelopeConclusion;
  failureClass: FailureClass;
  tier: number | null;
  executionMode: 'structured' | 'autonomous' | null;
  entityIds: string[];
  railBindingStatus: string;
  normalizedHash: string;
}

export type ResolvedCiContext = {
  prNumber: number | null;
  tier: number | null;
  executionMode: 'structured' | 'autonomous' | null;
  entityIds: string[];
  railBindingStatus: string;
  retryCount: number;
  runId: string | null;
};

export type CiContextResolverInput = {
  eventType: SupportedGithubEventType;
  payload: unknown;
  repository: string;
  prNumber: number | null;
  headSha: string;
};

export type CiContextResolver = (input: CiContextResolverInput) => ResolvedCiContext;

export type RetryTriggerResult = {
  accepted: boolean;
  reason: string;
};
