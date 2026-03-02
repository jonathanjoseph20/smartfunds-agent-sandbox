import { describe, expect, it } from 'vitest';

import { classifyFailure } from './classify.ts';

describe('classifyFailure', () => {
  it('maps deterministic check names to failure classes', () => {
    expect(classifyFailure({ checkName: 'Policy Gate' })).toBe('governance_failure');
    expect(classifyFailure({ checkName: 'Validate PR Contract' })).toBe('governance_failure');
    expect(classifyFailure({ checkName: 'governance/check' })).toBe('governance_failure');
    expect(classifyFailure({ checkName: 'unit tests' })).toBe('unit_test_failure');
    expect(classifyFailure({ checkName: 'integration-suite' })).toBe('integration_test_failure');
    expect(classifyFailure({ checkName: 'Lint + Typecheck' })).toBe('lint_failure');
    expect(classifyFailure({ checkName: 'schema validation' })).toBe('schema_failure');
    expect(classifyFailure({ checkName: 'rail enforcement gate' })).toBe('rail_enforcement_failure');
    expect(classifyFailure({ checkName: 'deploy' })).toBe('unknown_failure');
  });
});
