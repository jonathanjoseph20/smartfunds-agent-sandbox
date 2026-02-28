import { describe, expect, it } from 'vitest';

import { extractGovernanceError } from './extract-governance-error.ts';
import type { NormalizedCheck } from './types.ts';

const governanceCheck: NormalizedCheck = {
  name: 'governance',
  conclusion: 'failure',
  classification: 'governance',
  extracted: {
    governanceErrorCode: null,
    governanceErrorJson: null
  }
};

describe('extract governance error', () => {
  it('extracts error code from marked structured JSON', () => {
    const extracted = extractGovernanceError(governanceCheck, {
      name: 'governance',
      conclusion: 'FAILURE',
      output: {
        summary: 'GOVERNANCE_REPORT_JSON_START\n{"errorCode":"MISSING_TIER_LABEL","retryable":true,"source":"governance"}\nGOVERNANCE_REPORT_JSON_END'
      }
    });

    expect(extracted.governanceErrorCode).toBe('MISSING_TIER_LABEL');
    expect(extracted.governanceErrorJson).toEqual({
      code: null,
      errorCode: 'MISSING_TIER_LABEL',
      retryable: true,
      source: 'governance'
    });
  });

  it('falls back to deterministic key/value parsing', () => {
    const extracted = extractGovernanceError(governanceCheck, {
      name: 'governance',
      conclusion: 'FAILURE',
      output: {
        summary: 'details errorCode: invalid_body_format and noise'
      }
    });

    expect(extracted.governanceErrorCode).toBe('INVALID_BODY_FORMAT');
  });

  it('returns null for non-governance checks', () => {
    const extracted = extractGovernanceError({
      ...governanceCheck,
      classification: 'non_governance'
    }, {
      name: 'lint_tier0',
      conclusion: 'FAILURE',
      output: {
        summary: 'errorCode: MISSING_TIER_LABEL'
      }
    });

    expect(extracted).toEqual({
      governanceErrorCode: null,
      governanceErrorJson: null
    });
  });
});
