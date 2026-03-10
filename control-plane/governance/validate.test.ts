import { describe, expect, it } from 'vitest';

import { runGovernanceValidation } from './validate.ts';

describe('governance validate profile routing', () => {
  it('T-GVR1 supports route-only detection with fallback classification', async () => {
    const result = await runGovernanceValidation({
      mode: 'route',
      prData: {
        body: '',
        labels: [],
        changedFiles: ['docs/readme.md']
      }
    });

    expect(result.ok).toBe(true);
    expect(result.routing.source).toBe('fallback');
    expect(result.routing.requiredProfile).toBe('build');
    expect(result.routing.finalProfile).toBe('build');
  });

  it('T-GVR2 uses metadata profile detection when present', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: ['profile: build', '', '```evidence', 'Risk Tier: 3', '```'].join('\n'),
        labels: ['tier-3'],
        changedFiles: ['docs/readme.md']
      }
    });

    expect(result.ok).toBe(true);
    expect(result.routing.source).toBe('metadata');
    expect(result.routing.requestedProfile).toBe('build');
    expect(result.routing.finalProfile).toBe('build');
  });

  it('T-GVR3 allows build route without tier labels and evidence block', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: '',
        labels: [],
        changedFiles: ['docs/readme.md']
      }
    });

    expect(result.ok).toBe(true);
    expect(result.routing.finalProfile).toBe('build');
    expect(result.errors).toEqual([]);
    expect(result.report.requiredChecks).toEqual(['lint', 'policy_validation', 'scope_enforcement', 'tests']);
  });

  it('T-GVR4 does not fail solely for malformed evidence blocks', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: ['profile: build', '', '```evidence', 'missing-closing-fence'].join('\n'),
        labels: ['tier-1', 'tier-3-approved'],
        changedFiles: ['docs/readme.md']
      }
    });

    expect(result.ok).toBe(true);
    expect(result.errors.join('\n')).not.toContain('MISSING_EVIDENCE_BLOCK');
    expect(result.errors.join('\n')).not.toContain('EVIDENCE_FORMAT_ERROR');
  });

  it('T-GVR5 keeps core route strict with profile-native core checks', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: '',
        labels: [],
        changedFiles: ['control-plane/governance/validate.ts']
      }
    });

    expect(result.routing.finalProfile).toBe('core');
    expect(result.report.requiredChecks).toContain('core_policy_validation');
    expect(result.errors.join('\n')).not.toContain('MISSING_TIER_LABEL');
    expect(result.errors.join('\n')).not.toContain('MISSING_EVIDENCE_BLOCK');
  });

  it('T-GVR6 supports lite skip behavior', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: 'profile: lite',
        labels: [],
        changedFiles: []
      }
    });

    expect(result.ok).toBe(true);
    expect(result.routing.finalProfile).toBe('lite');
    expect(result.report.requiredChecks).toEqual([]);
    expect(result.report.warnings).toContain('Governance enforcement skipped: profile route resolved to lite.');
  });

  it('T-GVR7 routes core scope even when build is requested', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: 'profile: build',
        labels: [],
        changedFiles: ['control-plane/governance/validate.ts']
      }
    });

    expect(result.ok).toBe(false);
    expect(result.routing.requiredProfile).toBe('core');
    expect(result.routing.finalProfile).toBe('core');
    expect(result.errors).toContain('BUILD_REQUESTED_PROFILE_REQUIRES_CORE_SCOPE');
  });

  it('T-GVR8 ownership mismatch is diagnostics-only', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: 'profile: core',
        labels: [],
        changedFiles: ['unmapped/new-file.ts']
      }
    });

    expect(result.errors.join('\n')).not.toContain('Ownership violation');
    expect(result.report.warnings.some((warning) => warning.includes('Ownership diagnostic:'))).toBe(true);
  });

  it('T-GVR9 emits normalized profile-native reporting fields', async () => {
    const result = await runGovernanceValidation({
      mode: 'full',
      prData: {
        body: 'profile: build',
        labels: ['tier-0', 'tier-3-approved'],
        changedFiles: ['docs/readme.md']
      }
    });

    expect(result.report.requestedProfile).toBe('build');
    expect(result.report.requiredProfile).toBe('build');
    expect(result.report.finalProfile).toBe('build');
    expect(Array.isArray(result.report.matchedScopes)).toBe(true);
    expect(result.report.routingSource).toBe('metadata');
  });
});
