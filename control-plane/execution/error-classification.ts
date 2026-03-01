import { canonicalStringify, sha256 } from '../finance/determinism.ts';

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

export type FailureCategory =
  | 'governance'
  | 'lint'
  | 'typecheck'
  | 'unit'
  | 'integration'
  | 'schema'
  | 'infra'
  | 'unknown';

export type NormalizedFailure = {
  checkName: string;
  category: FailureCategory;
  normalizedMessage: string;
  code?: string;
};

const CATEGORY_TO_CLASS: Readonly<Record<FailureCategory, ErrorClass>> = {
  governance: 'GOVERNANCE_ERROR',
  lint: 'LINT_FAILURE',
  typecheck: 'TYPECHECK_FAILURE',
  unit: 'UNIT_TEST_FAILURE',
  integration: 'INTEGRATION_TEST_FAILURE',
  schema: 'SCHEMA_VALIDATION_FAILURE',
  infra: 'TRANSIENT_INFRA_ERROR',
  unknown: 'UNKNOWN_FAILURE'
};

const GOVERNANCE_CODE_TO_CLASS: Readonly<Record<string, ErrorClass>> = {
  OWNERSHIP_VIOLATION: 'OWNERSHIP_VIOLATION',
  UNOWNED_PATHS: 'OWNERSHIP_VIOLATION',
  AMBIGUOUS_OWNERSHIP: 'OWNERSHIP_VIOLATION',
  TIER_MISMATCH: 'TIER_MISMATCH',
  MISSING_EVIDENCE_BLOCK: 'EVIDENCE_SCHEMA_ERROR',
  MISSING_EVIDENCE_FIELDS: 'EVIDENCE_SCHEMA_ERROR',
  EVIDENCE_FORMAT_ERROR: 'EVIDENCE_SCHEMA_ERROR'
};

function normalizeCode(code: string | undefined): string | null {
  if (!code) {
    return null;
  }
  const normalized = code.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}

function resolveErrorClass(failure: NormalizedFailure): ErrorClass {
  if (failure.category === 'governance') {
    const code = normalizeCode(failure.code);
    if (code && code in GOVERNANCE_CODE_TO_CLASS) {
      return GOVERNANCE_CODE_TO_CLASS[code];
    }
  }
  return CATEGORY_TO_CLASS[failure.category] ?? 'UNKNOWN_FAILURE';
}

export function computeFailureSignature(input: {
  errorClass: ErrorClass;
  checkName: string;
  normalizedMessage: string;
  code?: string;
}): string {
  return sha256(canonicalStringify({
    errorClass: input.errorClass,
    checkName: input.checkName,
    normalizedMessage: input.normalizedMessage,
    code: normalizeCode(input.code)
  }));
}

export function classifyFailure(failure: NormalizedFailure): { errorClass: ErrorClass; failureSignature: string } {
  const errorClass = resolveErrorClass(failure);
  return {
    errorClass,
    failureSignature: computeFailureSignature({
      errorClass,
      checkName: failure.checkName,
      normalizedMessage: failure.normalizedMessage,
      code: failure.code
    })
  };
}
