import type { IneligibleReasonCode } from '../report/types.ts';
import { RETRYABLE_ERROR_CODES, type RetryState, type RetriableErrorCode } from '../retry/retry-engine.ts';
import type { NormalizedCiSummary } from './types.ts';

export type RetryEligibilityDecision = {
  eligible: boolean;
  ineligibleReason: IneligibleReasonCode | null;
  triggerErrorCode: RetriableErrorCode | null;
  triggerCheckName: string | null;
  triggerGovernanceErrorCode: string | null;
};

function toRetriableErrorCode(value: string | null): RetriableErrorCode | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  for (const code of RETRYABLE_ERROR_CODES) {
    if (code === normalized) {
      return code;
    }
  }
  return null;
}

export function evaluateRetryEligibilityForNormalizedCi(params: {
  executionMode: 'structured' | 'autonomous';
  ci: NormalizedCiSummary;
  retryState: RetryState;
}): RetryEligibilityDecision {
  if (params.ci.ciStatus === 'passed') {
    return {
      eligible: false,
      ineligibleReason: 'CI_PASSED',
      triggerErrorCode: null,
      triggerCheckName: null,
      triggerGovernanceErrorCode: null
    };
  }

  if (params.ci.ciStatus === 'unknown') {
    return {
      eligible: false,
      ineligibleReason: 'CI_UNKNOWN',
      triggerErrorCode: null,
      triggerCheckName: null,
      triggerGovernanceErrorCode: null
    };
  }

  if (params.executionMode !== 'autonomous') {
    return {
      eligible: false,
      ineligibleReason: 'MODE_NOT_AUTONOMOUS',
      triggerErrorCode: null,
      triggerCheckName: null,
      triggerGovernanceErrorCode: null
    };
  }

  if (params.retryState.retryCount > 0 || params.retryState.retryAttempted) {
    return {
      eligible: false,
      ineligibleReason: 'RETRY_ALREADY_CONSUMED',
      triggerErrorCode: params.retryState.triggerErrorCode,
      triggerCheckName: null,
      triggerGovernanceErrorCode: params.retryState.triggerErrorCode
    };
  }

  const governing = params.ci.governingFailure;
  if (!governing) {
    return {
      eligible: false,
      ineligibleReason: 'NO_GOVERNING_FAILURE',
      triggerErrorCode: null,
      triggerCheckName: null,
      triggerGovernanceErrorCode: null
    };
  }

  if (governing.classification !== 'governance') {
    return {
      eligible: false,
      ineligibleReason: 'NON_GOVERNANCE_GOVERNING_FAILURE',
      triggerErrorCode: null,
      triggerCheckName: governing.name,
      triggerGovernanceErrorCode: null
    };
  }

  const extractedCode = governing.extracted.governanceErrorCode;
  if (!extractedCode) {
    return {
      eligible: false,
      ineligibleReason: 'MISSING_GOVERNANCE_ERROR_CODE',
      triggerErrorCode: null,
      triggerCheckName: governing.name,
      triggerGovernanceErrorCode: null
    };
  }

  const retriable = toRetriableErrorCode(extractedCode);
  if (!retriable) {
    return {
      eligible: false,
      ineligibleReason: 'ERROR_CODE_NOT_RETRIABLE',
      triggerErrorCode: null,
      triggerCheckName: governing.name,
      triggerGovernanceErrorCode: extractedCode
    };
  }

  return {
    eligible: true,
    ineligibleReason: null,
    triggerErrorCode: retriable,
    triggerCheckName: governing.name,
    triggerGovernanceErrorCode: extractedCode
  };
}
