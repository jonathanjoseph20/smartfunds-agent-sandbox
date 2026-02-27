import type { GovernanceError, GovernanceErrorCode } from '../diagnostics.ts';
import type { RetryActionCategory, RetryActionCode, RetrySelection } from './types.ts';

const SUPPORTED_RETRY_CODES: RetryActionCode[] = [
  'MISSING_EVIDENCE_BLOCK',
  'MISSING_EVIDENCE_FIELDS',
  'MISSING_LABEL',
  'MISSING_TIER_LABEL'
];

function asCategory(code: RetryActionCode): RetryActionCategory {
  if (code === 'MISSING_EVIDENCE_BLOCK' || code === 'MISSING_EVIDENCE_FIELDS') {
    return 'body';
  }
  return 'labels';
}

function sortCodes(codes: GovernanceErrorCode[]): GovernanceErrorCode[] {
  return [...codes].sort((a, b) => a.localeCompare(b));
}

export function selectRetryAction(errors: GovernanceError[]): RetrySelection {
  const blocking = errors
    .filter((error) => error.severity === 'error')
    .map((error) => error.code as GovernanceErrorCode);
  const blockingErrorCodes = sortCodes(Array.from(new Set(blocking)));

  if (blockingErrorCodes.length === 0) {
    return {
      status: 'no-blocking',
      blockingErrorCodes
    };
  }

  const unsupportedBlockingCodes = blockingErrorCodes.filter((code) => !SUPPORTED_RETRY_CODES.includes(code as RetryActionCode));
  if (unsupportedBlockingCodes.length > 0) {
    return {
      status: 'unsupported',
      blockingErrorCodes,
      unsupportedBlockingCodes
    };
  }

  const retryableBlockingCodes = errors
    .filter((error) => error.severity === 'error' && error.retryable)
    .map((error) => error.code as RetryActionCode)
    .filter((code) => SUPPORTED_RETRY_CODES.includes(code));
  const selectedCode = Array.from(new Set(retryableBlockingCodes)).sort((a, b) => a.localeCompare(b))[0];

  if (!selectedCode) {
    return {
      status: 'unsupported',
      blockingErrorCodes,
      unsupportedBlockingCodes: blockingErrorCodes
    };
  }

  return {
    status: 'selected',
    code: selectedCode,
    category: asCategory(selectedCode),
    blockingErrorCodes
  };
}
