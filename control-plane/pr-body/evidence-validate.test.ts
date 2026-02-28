import { describe, expect, it } from 'vitest';

import { parsePrBodyForGovernance } from './evidence-parse.ts';
import { validateParsedEvidence } from './evidence-validate.ts';

const validBody = `tier-1

\`\`\`evidence
Risk Tier: 1
Justification: Low risk
Affected Paths: apps/api/src/index.ts
Tests Added: npm test
Determinism Statement: Deterministic and reproducible
\`\`\``;

describe('validateParsedEvidence', () => {
  it('returns valid result for valid parsed evidence', () => {
    const parsed = parsePrBodyForGovernance(validBody);
    const result = validateParsedEvidence(parsed);

    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns MISSING_TIER_LABEL when tier line is absent', () => {
    const parsed = parsePrBodyForGovernance(validBody.replace('tier-1\n\n', ''));
    const result = validateParsedEvidence(parsed);

    expect(result.errors.map((error) => error.code)).toContain('MISSING_TIER_LABEL');
  });

  it('returns INVALID_TIER_LABEL when tier label is malformed', () => {
    const parsed = parsePrBodyForGovernance(validBody.replace('tier-1', 'tier-9'));
    const result = validateParsedEvidence(parsed);

    expect(result.errors.map((error) => error.code)).toContain('INVALID_TIER_LABEL');
  });

  it('returns MISSING_EVIDENCE_BLOCK when evidence fence is missing', () => {
    const parsed = parsePrBodyForGovernance('tier-1\n\nmissing evidence');
    const result = validateParsedEvidence(parsed);

    expect(result.errors.map((error) => error.code)).toContain('MISSING_EVIDENCE_BLOCK');
  });

  it('returns MISSING_EVIDENCE_FIELDS when required keys are missing', () => {
    const parsed = parsePrBodyForGovernance(`tier-1

\`\`\`evidence
Risk Tier: 1
\`\`\``);
    const result = validateParsedEvidence(parsed);

    expect(result.errors.map((error) => error.code)).toContain('MISSING_EVIDENCE_FIELDS');
  });

  it('returns UNSUPPORTED_EVIDENCE_FIELDS for non-canonical keys', () => {
    const parsed = parsePrBodyForGovernance(`tier-1

\`\`\`evidence
Risk Tier: 1
Justification: ok
Affected Paths: apps/api/src/index.ts
Tests: npm test
Determinism: deterministic
\`\`\``);
    const result = validateParsedEvidence(parsed);

    expect(result.errors.map((error) => error.code)).toContain('UNSUPPORTED_EVIDENCE_FIELDS');
  });

  it('returns EVIDENCE_FORMAT_ERROR for malformed lines', () => {
    const parsed = parsePrBodyForGovernance(`tier-1

\`\`\`evidence
Risk Tier: 1
Justification only
\`\`\``);
    const result = validateParsedEvidence(parsed);

    expect(result.errors.map((error) => error.code)).toContain('EVIDENCE_FORMAT_ERROR');
  });

  it('sorts errors deterministically by code then message', () => {
    const parsed = parsePrBodyForGovernance(`tier-9

\`\`\`evidence
Justification only
Tests: no
\`\`\``);
    const result = validateParsedEvidence(parsed);

    expect(result.errors.map((error) => error.code)).toEqual([
      'EVIDENCE_FORMAT_ERROR',
      'INVALID_TIER_LABEL',
      'MISSING_EVIDENCE_FIELDS',
      'UNSUPPORTED_EVIDENCE_FIELDS'
    ]);
  });
});
