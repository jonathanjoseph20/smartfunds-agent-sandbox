import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildPreflightReport } from './governance-preflight';
import { buildCanonicalEvidence, stringifyEvidenceJson } from '../governance/evidence-contract.ts';
import { loadOwnershipProjects } from '../studio/registry';
import { resolveOwnership } from '../studio/ownership';

function makeOwnership() {
  return {
    projectsTouched: ['core-app'],
    teamsTouched: ['team-a'],
    unownedFiles: [],
    ownershipStatus: 'ok' as const,
    nextActions: []
  };
}

function runWithEvidence(evidenceJson: string, labels: string[], changedFiles = ['apps/api/src/index.ts']) {
  return buildPreflightReport(
    'tier-1\n\n```evidence\nRisk Tier: 1\n```',
    changedFiles,
    labels,
    {
      existsSync: (filePath) => filePath === 'governance/evidence.json' || filePath === 'governance/schema/evidence.schema.json',
      readFile: (filePath) => (filePath === 'governance/evidence.json' ? evidenceJson : '{}'),
      loadProjects: () => [],
      loadTeams: () => [],
      resolveOwnership: () => makeOwnership()
    }
  );
}

function canonicalEvidence(overrides: Partial<{
  tier: 0 | 1 | 2 | 3;
  mode: 'structured' | 'autonomous';
  affectedPaths: string[];
}> = {}): string {
  return stringifyEvidenceJson(
    buildCanonicalEvidence({
      tier: overrides.tier ?? 1,
      mode: overrides.mode ?? 'autonomous',
      affectedPaths: overrides.affectedPaths ?? ['apps/api/src/index.ts'],
      determinismStatement: 'No identity surfaces mutated.',
      retrySemanticsModified: false,
      autonomyScopeExpanded: false
    })
  );
}

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-governance-preflight-entities');

function resetTmp(): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmpRoot, 'entities', 'projects'), { recursive: true });
  fs.mkdirSync(path.join(tmpRoot, 'control-plane', 'projects'), { recursive: true });
}

function writeJson(filePath: string, data: unknown): void {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('governance:preflight', () => {
  it('fails when governance/evidence.json is missing', () => {
    const result = buildPreflightReport('tier-1', ['apps/api/src/index.ts'], ['tier-1'], {
      existsSync: () => false,
      readFile: () => '',
      loadProjects: () => [],
      loadTeams: () => [],
      resolveOwnership: () => makeOwnership()
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Missing governance/evidence.json');
  });

  it('fails with same error for markdown-only body when evidence file is missing', () => {
    const markdownOnlyBody = `tier-1

\`\`\`evidence
Risk Tier: 1
Justification: markdown only
\`\`\``;
    const result = buildPreflightReport(markdownOnlyBody, ['apps/api/src/index.ts'], ['tier-1'], {
      existsSync: () => false,
      readFile: () => '',
      loadProjects: () => [],
      loadTeams: () => [],
      resolveOwnership: () => makeOwnership()
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Missing governance/evidence.json');
  });

  it('fails on tier mismatch between evidence.json and labels', () => {
    const result = runWithEvidence(
      canonicalEvidence({ tier: 2 }),
      ['tier-1']
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('governance/evidence.json tier must be 1');
  });

  it('fails when affectedPaths mismatches computed changed files', () => {
    const result = runWithEvidence(
      canonicalEvidence({ affectedPaths: ['apps/api/src/other.ts'] }),
      ['tier-1']
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('Affected paths mismatch: governance/evidence.json must exactly match changed files.');
  });

  it('fails when affectedPaths are not sorted', () => {
    const result = runWithEvidence(
      '{\n' +
      '  "tier": 1,\n' +
      '  "mode": "autonomous",\n' +
      '  "affectedPaths": [\n' +
      '    "b.ts",\n' +
      '    "a.ts"\n' +
      '  ],\n' +
      '  "determinismStatement": "No identity surfaces mutated.",\n' +
      '  "retrySemanticsModified": false,\n' +
      '  "autonomyScopeExpanded": false\n' +
      '}\n',
      ['tier-1'],
      ['a.ts', 'b.ts']
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('Ensure affectedPaths is sorted and non-empty');
  });

  it('uses entities/projects as ownership source-of-truth when present', () => {
    resetTmp();
    writeJson(path.join(tmpRoot, 'entities', 'projects', 'entity-project.json'), {
      id: 'entity-project',
      name: 'Entity Project',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      ownedPaths: ['apps/entity/'],
      ownedFiles: []
    });
    writeJson(path.join(tmpRoot, 'control-plane', 'projects', 'fallback-project.json'), {
      projectId: 'fallback-project',
      ownedPaths: ['apps/fallback/**']
    });

    const evidence = canonicalEvidence({ tier: 1, affectedPaths: ['apps/entity/index.ts'] });

    const result = buildPreflightReport(
      'tier-1',
      ['apps/entity/index.ts'],
      ['tier-1'],
      {
        existsSync: (filePath) => filePath === 'governance/evidence.json' || filePath === 'governance/schema/evidence.schema.json',
        readFile: (filePath) => (filePath === 'governance/evidence.json' ? evidence : '{}'),
        loadProjects: () =>
          loadOwnershipProjects({
            entitiesProjectsDir: path.join(tmpRoot, 'entities', 'projects'),
            fallbackProjectsDir: path.join(tmpRoot, 'control-plane', 'projects')
          }),
        loadTeams: () => [],
        resolveOwnership
      }
    );

    expect(result.report.projectsTouched).toEqual(['entity-project']);
    expect(result.report.podsTouched).toEqual(['smartfunds']);
    expect(result.report.podByProject).toEqual({ 'entity-project': 'smartfunds' });
  });

  it('keeps projectsTouched deterministic from entity-backed ownership', () => {
    resetTmp();
    writeJson(path.join(tmpRoot, 'entities', 'projects', 'b.json'), {
      id: 'project-b',
      name: 'Project B',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      ownedPaths: ['apps/b/'],
      ownedFiles: []
    });
    writeJson(path.join(tmpRoot, 'entities', 'projects', 'a.json'), {
      id: 'project-a',
      name: 'Project A',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      ownedPaths: ['apps/a/'],
      ownedFiles: []
    });

    const evidence = canonicalEvidence({ tier: 1, affectedPaths: ['apps/a/1.ts', 'apps/b/2.ts'] });

    const result = buildPreflightReport(
      'tier-1',
      ['apps/b/2.ts', 'apps/a/1.ts'],
      ['tier-1'],
      {
        existsSync: (filePath) => filePath === 'governance/evidence.json' || filePath === 'governance/schema/evidence.schema.json',
        readFile: (filePath) => (filePath === 'governance/evidence.json' ? evidence : '{}'),
        loadProjects: () =>
          loadOwnershipProjects({
            entitiesProjectsDir: path.join(tmpRoot, 'entities', 'projects'),
            fallbackProjectsDir: path.join(tmpRoot, 'control-plane', 'projects')
          }),
        loadTeams: () => [],
        resolveOwnership
      }
    );

    expect(result.report.projectsTouched).toEqual(['project-a', 'project-b']);
  });
});
