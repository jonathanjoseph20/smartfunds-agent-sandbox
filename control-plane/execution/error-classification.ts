import { canonicalStringify, sha256 } from '../finance/determinism.ts';

export type NormalizedFailure = {
  checkName: string;
  failureType: string;
  normalizedMessage: string;
  tier: number;
  impliedTier: number;
  requiredChecks: string[];
};

export type ErrorClass =
  | 'GOVERNANCE_ERROR'
  | 'EVIDENCE_SCHEMA_ERROR'
  | 'TIER_MISMATCH'
  | 'OWNERSHIP_VIOLATION'
  | 'LINT_FAILURE'
  | 'TYPECHECK_FAILURE'
  | 'UNIT_TEST_FAILURE'
  | 'INTEGRATION_TEST_FAILURE'
  | 'SCHEMA_VALIDATION_FAILURE'
  | 'TRANSIENT_INFRA_ERROR'
  | 'UNKNOWN_FAILURE';

function normalizeToken(value: string): string {
  return value.trim().toUpperCase();
}

function includesAny(value: string, tokens: readonly string[]): boolean {
  return tokens.some((token) => value.includes(token));
}

function isGovernanceFailure(failureType: string, checkName: string): boolean {
  return includesAny(failureType, ['GOVERNANCE', 'POLICY_VALIDATION', 'VALIDATOR'])
    || includesAny(checkName, ['GOVERNANCE', 'PR_BODY', 'PR:VERIFY', 'POLICY', 'VALIDATE_PR']);
}

function isOwnershipViolation(failureType: string, checkName: string): boolean {
  return includesAny(failureType, ['OWNERSHIP_VIOLATION', 'UNOWNED_PATHS'])
    || includesAny(checkName, ['OWNERSHIP', 'UNOWNED']);
}

function isTierMismatch(failureType: string, checkName: string): boolean {
  return includesAny(failureType, ['TIER_MISMATCH', 'MISSING_TIER_LABEL'])
    || includesAny(checkName, ['TIER']);
}

function isEvidenceSchemaFailure(failureType: string, checkName: string): boolean {
  return includesAny(failureType, ['EVIDENCE_SCHEMA', 'MISSING_EVIDENCE', 'EVIDENCE_FORMAT'])
    || includesAny(checkName, ['EVIDENCE']);
}

function isLintFailure(failureType: string, checkName: string): boolean {
  return includesAny(failureType, ['LINT_FAILURE', 'ESLINT']) || checkName === 'LINT';
}

function isTypecheckFailure(failureType: string, checkName: string): boolean {
  return includesAny(failureType, ['TYPECHECK_FAILURE', 'TSC']) || includesAny(checkName, ['TYPECHECK', 'TSC']);
}

function isUnitTestFailure(failureType: string, checkName: string): boolean {
  return includesAny(failureType, ['UNIT_TEST_FAILURE']) || includesAny(checkName, ['UNIT_TEST', 'UNIT']);
}

function isIntegrationTestFailure(failureType: string, checkName: string): boolean {
  return includesAny(failureType, ['INTEGRATION_TEST_FAILURE']) || includesAny(checkName, ['INTEGRATION_TEST', 'INTEGRATION']);
}

function isSchemaValidationFailure(failureType: string, checkName: string): boolean {
  return includesAny(failureType, ['SCHEMA_VALIDATION_FAILURE', 'SCHEMA_VALIDATION']) || includesAny(checkName, ['SCHEMA']);
}

function isTransientInfraFailure(failureType: string): boolean {
  return failureType === 'TRANSIENT_INFRA_ERROR';
}

export function classifyFailure(failure: NormalizedFailure): ErrorClass {
  const failureType = normalizeToken(failure.failureType);
  const checkName = normalizeToken(failure.checkName);

  if (isGovernanceFailure(failureType, checkName)) {
    return 'GOVERNANCE_ERROR';
  }
  if (isOwnershipViolation(failureType, checkName)) {
    return 'OWNERSHIP_VIOLATION';
  }
  if (isTierMismatch(failureType, checkName)) {
    return 'TIER_MISMATCH';
  }
  if (isEvidenceSchemaFailure(failureType, checkName)) {
    return 'EVIDENCE_SCHEMA_ERROR';
  }
  if (isLintFailure(failureType, checkName)) {
    return 'LINT_FAILURE';
  }
  if (isTypecheckFailure(failureType, checkName)) {
    return 'TYPECHECK_FAILURE';
  }
  if (isUnitTestFailure(failureType, checkName)) {
    return 'UNIT_TEST_FAILURE';
  }
  if (isIntegrationTestFailure(failureType, checkName)) {
    return 'INTEGRATION_TEST_FAILURE';
  }
  if (isSchemaValidationFailure(failureType, checkName)) {
    return 'SCHEMA_VALIDATION_FAILURE';
  }
  if (isTransientInfraFailure(failureType)) {
    return 'TRANSIENT_INFRA_ERROR';
  }

  return 'UNKNOWN_FAILURE';
}

export function computeFailureSignature(input: {
  errorClass: ErrorClass;
  checkName: string;
  normalizedMessage: string;
}): string {
  return sha256(canonicalStringify({
    checkName: input.checkName,
    errorClass: input.errorClass,
    normalizedMessage: input.normalizedMessage
  }));
}
