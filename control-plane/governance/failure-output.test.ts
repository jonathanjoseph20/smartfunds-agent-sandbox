import { describe, expect, it } from 'vitest';

import { renderGovernanceFailureSummary } from './failure-output.ts';
import { buildGovernanceReport } from './diagnostics.ts';

describe('governance failure output', () => {
  it('prints actionable mixed-mode details and split suggestions', () => {
    const report = buildGovernanceReport({
      declaredTier: 3,
      impliedTier: 3,
      labelTier: 3,
      missingLabels: [],
      missingEvidenceFields: [],
      requiredChecks: [],
      projectsTouched: [],
      teamsTouched: [],
      swarmsTouched: [],
      unownedFiles: [],
      ownershipStatus: 'ok',
      nextActions: [],
      warnings: [],
      executionModesTouched: ['autonomous', 'structured'],
      modeBoundaryStatus: 'multi_mode_conflict',
      conflictingTeams: [],
      conflictingPaths: [],
      swarmExecutionModesTouched: ['autonomous', 'structured'],
      modeWarnings: [],
      unownedPaths: [],
      ambiguousPaths: [],
      structuredPathsTouched: ['.github/workflows/governance-full.yml', 'control-plane/validate-pr.ts'],
      autonomousPathsTouched: ['apps/web/index.ts', 'packages/frontend/app.ts']
    });

    const output = renderGovernanceFailureSummary({
      report,
      errors: ['Mode policy violation: mixed execution modes detected'],
      primaryAction: null
    });

    expect(output).toContain('❌ GOVERNANCE FAILED');
    expect(output).toContain('Primary Violation: Mixed execution modes detected.');
    expect(output).toContain('Structured paths (2):');
    expect(output).toContain('Autonomous paths (2):');
    expect(output).toContain('PR A: .github/**, control-plane/**');
    expect(output).toContain('PR B: apps/**, packages/**');
  });

  it('prints exact evidence drift remediation commands', () => {
    const report = buildGovernanceReport({
      declaredTier: 2,
      impliedTier: 2,
      labelTier: 2,
      missingLabels: [],
      missingEvidenceFields: [],
      requiredChecks: [],
      projectsTouched: [],
      teamsTouched: [],
      swarmsTouched: [],
      unownedFiles: [],
      ownershipStatus: 'ok',
      nextActions: [],
      warnings: [],
      executionModesTouched: ['structured'],
      modeBoundaryStatus: 'ok',
      conflictingTeams: [],
      conflictingPaths: [],
      swarmExecutionModesTouched: ['structured'],
      modeWarnings: [],
      unownedPaths: [],
      ambiguousPaths: []
    });

    const output = renderGovernanceFailureSummary({
      report,
      errors: ['Evidence drift detected. Run: npm run governance:emit'],
      primaryAction: null
    });

    expect(output).toContain('npm run governance:emit');
    expect(output).toContain('git add governance/evidence.json');
    expect(output).toContain('git commit -m "fix(governance): canonicalize evidence"');
  });
});
