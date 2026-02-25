import { describe, expect, it, vi } from 'vitest';

import { runGovernanceCheck } from './governance-check';

let railBindingResult = {
  diagnostics: {
    entityRailProfileByEntity: {},
    entitiesMissingRailProfile: [],
    railBindingStatus: 'ok' as const,
    railViolations: [],
    railEnforcementErrors: []
  },
  warnings: [],
  nextActions: []
};

vi.mock('./governance/rail-binding', () => ({
  resolveRailBindingDiagnostics: () => railBindingResult
}));

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
    railBindingResult = {
      diagnostics: {
        entityRailProfileByEntity: {},
        entitiesMissingRailProfile: [],
        railBindingStatus: 'ok',
        railViolations: [],
        railEnforcementErrors: []
      },
      warnings: [],
      nextActions: []
    };

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
    railBindingResult = {
      diagnostics: {
        entityRailProfileByEntity: {},
        entitiesMissingRailProfile: [],
        railBindingStatus: 'ok',
        railViolations: [],
        railEnforcementErrors: []
      },
      warnings: [],
      nextActions: []
    };

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
    railBindingResult = {
      diagnostics: {
        entityRailProfileByEntity: {},
        entitiesMissingRailProfile: [],
        railBindingStatus: 'ok',
        railViolations: [],
        railEnforcementErrors: []
      },
      warnings: [],
      nextActions: []
    };

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
    railBindingResult = {
      diagnostics: {
        entityRailProfileByEntity: {},
        entitiesMissingRailProfile: [],
        railBindingStatus: 'ok',
        railViolations: [],
        railEnforcementErrors: []
      },
      warnings: [],
      nextActions: []
    };

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

  it('blocks when rail enforcement errors are present', async () => {
    railBindingResult = {
      diagnostics: {
        entityRailProfileByEntity: {
          'entity-a': 'structured-only',
          'entity-b': 'autonomous-only'
        },
        entitiesMissingRailProfile: [],
        railBindingStatus: 'multi_entity_mixed_profiles',
        railViolations: [],
        railEnforcementErrors: [
          'Rail enforcement: incompatible rail profiles detected (structured-only vs autonomous-only). Entities: entity-a:structured-only, entity-b:autonomous-only.'
        ]
      },
      warnings: [],
      nextActions: []
    };

    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => body,
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('incompatible rail profiles detected');
  });

  it('warns on missing rail profiles without blocking', async () => {
    railBindingResult = {
      diagnostics: {
        entityRailProfileByEntity: {
          'entity-a': 'structured-only',
          'entity-b': null
        },
        entitiesMissingRailProfile: ['entity-b'],
        railBindingStatus: 'missing_rail_profile',
        railViolations: [],
        railEnforcementErrors: []
      },
      warnings: ['Missing rail profile mappings for touched entities: entity-b.'],
      nextActions: ['Add missing entityId railProfile mappings to control-plane/entities/rails.json.']
    };

    const result = await runGovernanceCheck({
      bodyFile: 'pr-body.md',
      readFile: () => body,
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(true);
    expect(result.report.warnings.join('\n')).toContain('Missing rail profile mappings for touched entities');
    expect(result.report.nextActions.join('\n')).toContain('Add missing entityId railProfile mappings');
    expect(result.errors.join('\n')).not.toContain('Missing rail profile mappings');
  });
});
