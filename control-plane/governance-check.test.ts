import fs from 'node:fs';

import { describe, expect, it, vi } from 'vitest';

import { runGovernanceCheck } from './governance-check';

function makeBody(tier: 0 | 1 | 2 | 3, extraEvidenceLines: string[] = []): string {
  return `tier-${tier}

\`\`\`evidence
Risk Tier: ${tier}
Justification: App-only change
Affected Paths: apps/api/src/index.ts
Tests Added: npm --workspace @smartfunds/api run test
Determinism Statement: Static inputs and deterministic assertions
${extraEvidenceLines.join('\n')}
\`\`\``;
}

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
      readFile: () => makeBody(1),
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(true);
    expect(result.report.labelTier).toBe(1);
    expect(result.report.requiredChecks).toContain('unit_tests');
    expect(result.report.swarmOrchestrationStatus).toBe('ok');
    expect(result.report.swarmOrchestrationViolations).toEqual([]);
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
      readFile: () => makeBody(1),
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: 'token',
      repo: 'owner/repo',
      fetchImpl
    });

    expect(result.report.missingLabels).toContain('tier-3');
    expect(result.report.nextActions.join('\n')).toContain('npm run bootstrap:labels');
  });

  it('fails mixed execution modes with mode enforcement diagnostics', async () => {
    const tier2Body = makeBody(2);

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

  it('fails autonomous swarm when structured paths are touched', async () => {
    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => makeBody(2, ['Swarm: swarm-contract-v1', 'Swarm Mode: autonomous', 'Swarm Team: governance']),
      gitExec: makeGitExec(['governance/policy.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('swarm_autonomous_structured_violation');
  });

  it('passes autonomous swarm on autonomous-only paths', async () => {
    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => makeBody(1, ['Swarm: swarm-contract-v1', 'Swarm Mode: autonomous', 'Swarm Team: governance']),
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(true);
    expect(result.report.swarmMode).toBe('autonomous');
    expect(result.report.swarmWarnings).toEqual([]);
  });

  it('passes structured swarm on structured paths', async () => {
    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => makeBody(3, ['Swarm: swarm-contract-v1', 'Swarm Mode: structured', 'Swarm Team: governance']),
      gitExec: makeGitExec(['control-plane/governance/validate.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(true);
    expect(result.report.swarmMode).toBe('structured');
  });

  it('warns when multiple swarms are declared', async () => {
    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => makeBody(1, ['Swarm: zeta', 'Swarm: alpha', 'Swarm Mode: structured']),
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(true);
    expect(result.report.swarmsDeclared).toEqual(['alpha', 'zeta']);
    expect(result.report.swarmWarnings).toContain('multiple_swarms_declared');
  });

  it('warns on invalid swarm mode', async () => {
    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => makeBody(1, ['Swarm: swarm-contract-v1', 'Swarm Mode: invalid']),
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(true);
    expect(result.report.swarmMode).toBeNull();
    expect(result.report.swarmWarnings).toContain('invalid_swarm_mode');
  });

  it('passes when no swarm metadata is declared', async () => {
    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => makeBody(1),
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(true);
    expect(result.report.swarmsDeclared).toEqual([]);
    expect(result.report.swarmWarnings).toEqual([]);
    expect(result.report.swarmMode).toBeNull();
    expect(result.report.swarmTeamId).toBeNull();
  });

  it('fails when swarms are touched and orchestration registry is missing', async () => {
    const existsSync = fs.existsSync.bind(fs);
    const existsSpy = vi.spyOn(fs, 'existsSync').mockImplementation((filePath: fs.PathLike) => {
      const normalized = String(filePath);
      if (normalized === 'control-plane/swarms/orchestration.json') {
        return false;
      }
      return existsSync(filePath);
    });

    try {
      const result = await runGovernanceCheck({
        bodyFile: 'pr-body.md',
        readFile: () => makeBody(1, ['Swarm: dev-team']),
        gitExec: makeGitExec(['docs/architecture.md']),
        token: '',
        repo: ''
      });

      expect(result.ok).toBe(false);
      expect(result.report.swarmsTouched.length).toBeGreaterThan(0);
      expect(result.report.swarmOrchestrationStatus).toBe('missing_registry');
      expect(result.errors).toContain('orchestration.missing_registry: control-plane/swarms/orchestration.json');
    } finally {
      existsSpy.mockRestore();
    }
  });
});
