import { describe, expect, it } from 'vitest';

import {
  buildGovernanceReport,
  stringifyGovernanceReport,
  validateEvidenceBlockSchema
} from './diagnostics';

describe('governance diagnostics', () => {
  it('stringifies report with deterministic ordering', () => {
    const report = buildGovernanceReport({
      declaredTier: 2,
      impliedTier: 3,
      labelTier: 2,
      missingLabels: ['tier-2', 'tier-1', 'tier-2'],
      missingEvidenceFields: ['Tests Added', 'Affected Paths'],
      requiredChecks: ['unit_tests', 'lint_tier0'],
      projectsTouched: ['project-b', 'project-a'],
      teamsTouched: ['team-b', 'team-a'],
      unownedFiles: ['z.md', 'a.md'],
      ownershipStatus: 'multi_project',
      nextActions: ['Run: git push', 'Add label: tier-3-approved.'],
      warnings: ['b', 'a'],
      executionModesTouched: ['structured', 'autonomous'],
      modeWarnings: ['UNOWNED_PATHS', 'MIXED_MODE_PR'],
      unownedPaths: ['scripts/z.ts', 'scripts/a.ts'],
      ambiguousPaths: ['x.ts', 'a.ts']
    });

    const json = stringifyGovernanceReport(report);
    expect(json).toBe(
      JSON.stringify({
        declaredTier: 2,
        impliedTier: 3,
        labelTier: 2,
        missingLabels: ['tier-1', 'tier-2'],
        missingEvidenceFields: ['Affected Paths', 'Tests Added'],
        requiredChecks: ['lint_tier0', 'unit_tests'],
        projectsTouched: ['project-a', 'project-b'],
        teamsTouched: ['team-a', 'team-b'],
        unownedFiles: ['a.md', 'z.md'],
        ownershipStatus: 'multi_project',
        nextActions: ['Add label: tier-3-approved.', 'Run: git push'],
        warnings: ['a', 'b'],
        executionModesTouched: ['autonomous', 'structured'],
        modeWarnings: ['MIXED_MODE_PR', 'UNOWNED_PATHS'],
        unownedPaths: ['scripts/a.ts', 'scripts/z.ts'],
        ambiguousPaths: ['a.ts', 'x.ts'],
        modeEnforcementStatus: 'failed',
        modeViolation: 'mixed_execution_modes',
        requiredMinimumTier: null
      })
    );
  });

  it('tracks missing evidence fields when evidence block is missing', () => {
    const result = validateEvidenceBlockSchema('No evidence here');
    expect(result.missingFields).toContain('Risk Tier');
    expect(result.missingFields).toContain('Determinism Statement');
    expect(result.errors.join('\n')).toContain('Missing fenced evidence block');
  });
});
