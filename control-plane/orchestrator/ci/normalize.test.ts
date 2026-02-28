import { describe, expect, it } from 'vitest';

import { normalizeCi } from './normalize.ts';

describe('ci normalize', () => {
  it('sorts checks by name deterministically and picks governance failure', () => {
    const summary = normalizeCi([
      { name: 'unit_tests', conclusion: 'FAILURE' },
      {
        name: 'governance',
        conclusion: 'FAILURE',
        output: { summary: 'errorCode: MISSING_TIER_LABEL' }
      },
      { name: 'lint_tier0', conclusion: 'SUCCESS' }
    ]);

    expect(summary.ciStatus).toBe('failed');
    expect(summary.checks.map((check) => check.name)).toEqual(['governance', 'lint_tier0', 'unit_tests']);
    expect(summary.governingFailure?.name).toBe('governance');
    expect(summary.governingFailure?.extracted.governanceErrorCode).toBe('MISSING_TIER_LABEL');
  });

  it('classifies governance checks from allowlist and marker text', () => {
    const summary = normalizeCi([
      {
        name: 'custom-check',
        conclusion: 'FAILURE',
        output: { summary: 'GOVERNANCE_REPORT_JSON_START\n{"errorCode":"MISSING_TIER_LABEL"}\nGOVERNANCE_REPORT_JSON_END' }
      }
    ]);

    expect(summary.checks[0].classification).toBe('governance');
    expect(summary.governingFailure?.name).toBe('custom-check');
  });

  it('returns unknown status for partial/incomplete CI states', () => {
    const summary = normalizeCi([
      { name: 'governance', state: 'IN_PROGRESS' },
      { name: 'lint_tier0', conclusion: 'SUCCESS' }
    ]);

    expect(summary.ciStatus).toBe('unknown');
    expect(summary.governingFailure).toBeNull();
    expect(summary.governingReason).toBe('CI_STATUS_UNKNOWN');
  });
});
