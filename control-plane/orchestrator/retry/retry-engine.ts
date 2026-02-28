import type { GovernanceError, GovernanceReport } from '../../governance/diagnostics.ts';

export const RETRYABLE_ERROR_CODES = [
  'MISSING_EVIDENCE_FIELD',
  'MISSING_TIER_LABEL',
  'MISSING_APPROVAL_LABEL',
  'INVALID_BODY_FORMAT',
  'UNOWNED_PATHS'
] as const;

export type RetriableErrorCode = (typeof RETRYABLE_ERROR_CODES)[number];

export type RetryFinalStatus = 'pending' | 'passed' | 'failed' | 'failed_after_retry';

export type RetryState = {
  retryEnabled: boolean;
  retryCount: number;
  retryAttempted: boolean;
  triggerErrorCode: RetriableErrorCode | null;
  finalStatus: RetryFinalStatus;
};

export type RetryDecision = {
  eligible: boolean;
  reason:
    | 'ci_not_failed'
    | 'non_governance_failure'
    | 'non_retryable_error'
    | 'retry_limit_reached'
    | 'structured_mode_disabled'
    | 'eligible';
  triggerErrorCode: RetriableErrorCode | null;
};

export type GovernanceRetryContext = {
  retryEnabled: boolean;
  retryCount: number;
  triggerErrorCode: RetriableErrorCode | null;
  retryAppliedFix: RetryAppliedFix | null;
};

export type RetryAppliedFix =
  | 'ADD_LABEL'
  | 'ADD_APPROVAL_LABEL'
  | 'REGENERATE_BODY'
  | 'NORMALIZE_BODY'
  | 'ASSIGN_PROJECT_MAPPING';

export type DeterministicFixPlan = {
  errorCode: RetriableErrorCode;
  fix: RetryAppliedFix;
};

const JSON_START = 'GOVERNANCE_REPORT_JSON_START';
const JSON_END = 'GOVERNANCE_REPORT_JSON_END';

function sortedUnique(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function normalizeGovernanceErrors(errors: GovernanceError[]): GovernanceError[] {
  return [...errors].sort((left, right) => {
    const codeCompare = left.code.localeCompare(right.code);
    if (codeCompare !== 0) {
      return codeCompare;
    }
    const severityCompare = left.severity.localeCompare(right.severity);
    if (severityCompare !== 0) {
      return severityCompare;
    }
    return left.message.localeCompare(right.message);
  });
}

function hasBlockingError(errors: GovernanceError[]): boolean {
  return errors.some((error) => error.severity === 'error');
}

function mapGovernanceErrorToRetriableCode(error: GovernanceError, report: GovernanceReport): RetriableErrorCode | null {
  if (error.code === 'MISSING_TIER_LABEL') {
    return 'MISSING_TIER_LABEL';
  }

  if (error.code === 'MISSING_LABEL' && error.message.includes('tier-3-approved')) {
    return 'MISSING_APPROVAL_LABEL';
  }

  if (error.code === 'MISSING_EVIDENCE_FIELDS' || error.code === 'MISSING_EVIDENCE_BLOCK') {
    if (report.missingEvidenceFields.length > 0) {
      return 'MISSING_EVIDENCE_FIELD';
    }
    return 'INVALID_BODY_FORMAT';
  }

  if (error.code === 'EVIDENCE_FORMAT_ERROR') {
    return 'INVALID_BODY_FORMAT';
  }

  if (error.code === 'UNOWNED_PATHS') {
    return 'UNOWNED_PATHS';
  }

  return null;
}

export function createInitialRetryState(): RetryState {
  return {
    retryEnabled: true,
    retryCount: 0,
    retryAttempted: false,
    triggerErrorCode: null,
    finalStatus: 'pending'
  };
}

export function extractGovernanceReportJson(rawOutput: string): string {
  const start = rawOutput.indexOf(JSON_START);
  const end = rawOutput.indexOf(JSON_END);

  if (start >= 0 && end > start) {
    const value = rawOutput.slice(start + JSON_START.length, end).trim();
    if (value.startsWith('{') && value.endsWith('}')) {
      return value;
    }
  }

  const firstBrace = rawOutput.indexOf('{');
  const lastBrace = rawOutput.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return rawOutput.slice(firstBrace, lastBrace + 1);
  }

  throw new Error('Unable to parse governance JSON output.');
}

export function parseGovernanceReport(rawOutput: string): GovernanceReport {
  const json = extractGovernanceReportJson(rawOutput);
  const parsed = JSON.parse(json) as GovernanceReport;
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.errors)) {
    throw new Error('Invalid governance report payload.');
  }

  return {
    ...parsed,
    missingEvidenceFields: sortedUnique(parsed.missingEvidenceFields ?? []),
    errors: normalizeGovernanceErrors(parsed.errors)
  };
}

export function classifyRetriableGovernanceError(report: GovernanceReport): RetriableErrorCode | null {
  const candidates = normalizeGovernanceErrors(report.errors)
    .filter((error) => error.severity === 'error')
    .map((error) => mapGovernanceErrorToRetriableCode(error, report))
    .filter((code): code is RetriableErrorCode => code !== null);

  if (candidates.length === 0) {
    return null;
  }

  const priorityOrder: RetriableErrorCode[] = [
    'MISSING_APPROVAL_LABEL',
    'MISSING_TIER_LABEL',
    'MISSING_EVIDENCE_FIELD',
    'INVALID_BODY_FORMAT',
    'UNOWNED_PATHS'
  ];

  for (const code of priorityOrder) {
    if (candidates.includes(code)) {
      return code;
    }
  }

  return null;
}

export function evaluateRetryEligibility(params: {
  executionMode: 'structured' | 'autonomous';
  ciStatus: 'passed' | 'failed';
  retryState: RetryState;
  governanceReport: GovernanceReport | null;
}): RetryDecision {
  if (params.ciStatus !== 'failed') {
    return {
      eligible: false,
      reason: 'ci_not_failed',
      triggerErrorCode: null
    };
  }

  if (params.executionMode !== 'autonomous') {
    return {
      eligible: false,
      reason: 'structured_mode_disabled',
      triggerErrorCode: null
    };
  }

  if (params.retryState.retryCount > 0 || params.retryState.retryAttempted) {
    return {
      eligible: false,
      reason: 'retry_limit_reached',
      triggerErrorCode: params.retryState.triggerErrorCode
    };
  }

  if (!params.governanceReport) {
    return {
      eligible: false,
      reason: 'non_governance_failure',
      triggerErrorCode: null
    };
  }

  if (!hasBlockingError(params.governanceReport.errors)) {
    return {
      eligible: false,
      reason: 'non_governance_failure',
      triggerErrorCode: null
    };
  }

  const triggerErrorCode = classifyRetriableGovernanceError(params.governanceReport);
  if (!triggerErrorCode) {
    return {
      eligible: false,
      reason: 'non_retryable_error',
      triggerErrorCode: null
    };
  }

  return {
    eligible: true,
    reason: 'eligible',
    triggerErrorCode
  };
}

export function buildDeterministicFixPlan(code: RetriableErrorCode): DeterministicFixPlan {
  const fixByCode: Record<RetriableErrorCode, RetryAppliedFix> = {
    MISSING_TIER_LABEL: 'ADD_LABEL',
    MISSING_APPROVAL_LABEL: 'ADD_APPROVAL_LABEL',
    MISSING_EVIDENCE_FIELD: 'REGENERATE_BODY',
    INVALID_BODY_FORMAT: 'NORMALIZE_BODY',
    UNOWNED_PATHS: 'ASSIGN_PROJECT_MAPPING'
  };

  return {
    errorCode: code,
    fix: fixByCode[code]
  };
}

export function withFinalStatus(state: RetryState, finalStatus: RetryFinalStatus): RetryState {
  return {
    ...state,
    finalStatus
  };
}

export function withRetryAttempt(state: RetryState, params: {
  triggerErrorCode: RetriableErrorCode;
  finalStatus: Exclude<RetryFinalStatus, 'pending'>;
}): RetryState {
  return {
    ...state,
    retryCount: 1,
    retryAttempted: true,
    triggerErrorCode: params.triggerErrorCode,
    finalStatus: params.finalStatus
  };
}

export function toGovernanceRetryContext(state: RetryState, retryAppliedFix: RetryAppliedFix | null): GovernanceRetryContext {
  return {
    retryEnabled: state.retryEnabled,
    retryCount: state.retryCount,
    triggerErrorCode: state.triggerErrorCode,
    retryAppliedFix
  };
}
