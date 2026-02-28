export const GOVERNANCE_JSON_START_MARKER = 'GOVERNANCE_REPORT_JSON_START';
export const GOVERNANCE_JSON_END_MARKER = 'GOVERNANCE_REPORT_JSON_END';

export const GOVERNANCE_CHECK_NAME_ALLOWLIST = [
  'governance',
  'governance check',
  'governance-check',
  'governance / check',
  'pr body check',
  'pr-body-check',
  'pr:body:check',
  'pr:verify'
] as const;

export const GOVERNANCE_CHECK_PRIORITY = [
  'governance',
  'governance check',
  'governance-check',
  'pr:verify',
  'pr-body-check',
  'pr body check'
] as const;

export type RawCheck = {
  name?: string | null;
  status?: string | null;
  conclusion?: string | null;
  state?: string | null;
  detailsUrl?: string | null;
  output?: {
    summary?: string | null;
    text?: string | null;
  } | null;
};

export type NormalizedConclusion =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'neutral'
  | 'timed_out'
  | 'action_required'
  | 'unknown';

export type CheckClassification = 'governance' | 'non_governance' | 'unknown';

export type GovernanceErrorJson = {
  code: string | null;
  errorCode: string | null;
  retryable: boolean | null;
  source: string | null;
};

export type GovernanceExtraction = {
  governanceErrorCode: string | null;
  governanceErrorJson: GovernanceErrorJson | null;
};

export type NormalizedCheck = {
  name: string;
  conclusion: NormalizedConclusion;
  classification: CheckClassification;
  extracted: GovernanceExtraction;
};

export type GoverningReason =
  | 'CI_STATUS_UNKNOWN'
  | 'GOVERNANCE_FAILURE_PRESENT'
  | 'MULTIPLE_GOVERNANCE_FAILURES_PICKED_FIRST'
  | 'ONLY_NON_GOVERNANCE_FAILURES'
  | 'NO_FAILED_CHECKS';

export type NormalizedCiStatus = 'passed' | 'failed' | 'unknown';

export type NormalizedCiSummary = {
  ciStatus: NormalizedCiStatus;
  checks: NormalizedCheck[];
  failedChecks: NormalizedCheck[];
  governingFailure: NormalizedCheck | null;
  governingReason: GoverningReason | null;
};
