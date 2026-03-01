import { sha256 } from '../finance/determinism.ts';
import type { ErrorClass } from './error-classification.ts';

export const MAX_RETRY_ATTEMPTS = 1;

export const RETRY_ERROR_CODES = {
  INVALID_ATTEMPT_INDEX: 'ERR_INVALID_ATTEMPT_INDEX',
  RETRY_NOT_ELIGIBLE: 'ERR_RETRY_NOT_ELIGIBLE'
} as const;

const RETRYABLE_ERROR_CLASSES: ReadonlySet<ErrorClass> = new Set([
  'LINT_FAILURE',
  'TYPECHECK_FAILURE',
  'UNIT_TEST_FAILURE',
  'INTEGRATION_TEST_FAILURE'
]);

export class RetryAttemptError extends Error {
  public readonly code = RETRY_ERROR_CODES.INVALID_ATTEMPT_INDEX;

  constructor(attemptIndex: number) {
    super(`Invalid attempt index: ${attemptIndex}. Max allowed is ${MAX_RETRY_ATTEMPTS}.`);
    this.name = 'RetryAttemptError';
  }
}

export class RetryEligibilityError extends Error {
  public readonly code = RETRY_ERROR_CODES.RETRY_NOT_ELIGIBLE;

  constructor(attemptIndex: number, errorClass: ErrorClass) {
    super(`Retry not eligible for attemptIndex=${attemptIndex} and errorClass=${errorClass}.`);
    this.name = 'RetryEligibilityError';
  }
}

export function assertValidAttemptIndex(attemptIndex: number): void {
  if (!Number.isInteger(attemptIndex) || attemptIndex < 0 || attemptIndex > MAX_RETRY_ATTEMPTS) {
    throw new RetryAttemptError(attemptIndex);
  }
}

export function computeAttemptId(runId: string, attemptIndex: number): string {
  assertValidAttemptIndex(attemptIndex);
  return sha256(`${runId}:${attemptIndex}`);
}

export function isRetryEligible(args: {
  attemptIndex: number;
  errorClass: ErrorClass;
}): boolean {
  if (args.attemptIndex !== 0) {
    return false;
  }

  return RETRYABLE_ERROR_CLASSES.has(args.errorClass);
}

export function assertRetryEligible(args: {
  attemptIndex: number;
  errorClass: ErrorClass;
}): void {
  if (!isRetryEligible(args)) {
    throw new RetryEligibilityError(args.attemptIndex, args.errorClass);
  }
}
