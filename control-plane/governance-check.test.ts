import { describe, expect, it } from 'vitest';

import { runGovernanceCheck } from './governance-check';

const body = `tier-1

\`\`\`evidence
Risk Tier: 1
Justification: App-only change
Affected Paths: apps/api/src/index.ts
Tests Added: npm --workspace @smartfunds/api run test
Determinism Statement: Static inputs and deterministic assertions
\`\`\``;

function makeGitExec(changedFiles: string[]): (args: string[]) => string {
  return (args) => {
    if (args[0] === 'merge-base') {
      return 'base-sha';
    }
    if (args[0] === 'diff') {
      return changedFiles.join('\n');
    }
    throw new Error(`unexpected git args: ${args.join(' ')}`);
  };
}

describe('governance:check', () => {
  it('passes with matching tier and implied tier', async () => {
    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => body,
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(true);
    expect(result.report.labelTier).toBe(1);
    expect(result.report.requiredChecks).toContain('unit_tests');
  });

  it('fails when evidence block is missing', async () => {
    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => 'tier-1',
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(false);
    expect(result.report.missingEvidenceFields).toContain('Risk Tier');
    expect(result.errors.join('\n')).toContain('Missing fenced evidence block');
  });

  it('reports missing repo labels when token is provided', async () => {
    const fetchImpl = async (url: string) => {
      const page = new URL(url).searchParams.get('page');
      if (page && Number.parseInt(page, 10) > 1) {
        return {
          ok: true,
          json: async () => [],
          text: async () => ''
        } as Response;
      }
      return {
        ok: true,
        json: async () => [{ name: 'tier-0' }],
        text: async () => ''
      } as Response;
    };

    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => body,
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: 'token',
      repo: 'owner/repo',
      fetchImpl
    });

    expect(result.report.missingLabels).toContain('tier-3');
    expect(result.report.nextActions.join('\n')).toContain('npm run bootstrap:labels');
  });

  it('fails mixed execution modes with mode enforcement diagnostics', async () => {
    const tier2Body = body.replace('tier-1', 'tier-2').replace('Risk Tier: 1', 'Risk Tier: 2');

    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => tier2Body,
      gitExec: makeGitExec(['apps/api/src/index.ts', 'governance/policy.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(false);
    expect(result.report.modeEnforcementStatus).toBe('failed');
    expect(result.report.modeViolation).toBe('mixed_execution_modes');
    expect(result.errors.join('\n')).toContain('mixed execution modes detected');
  });
});
