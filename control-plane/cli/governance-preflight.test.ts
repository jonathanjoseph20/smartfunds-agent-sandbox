import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { buildPreflightReport } from './governance-preflight';
import { buildCanonicalEvidence, stringifyEvidenceJson } from '../governance/evidence-contract';

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
  const schema = fs.readFileSync('governance/schema/evidence.schema.json', 'utf8');
  return buildPreflightReport(
    'tier-1\n\n```evidence\nRisk Tier: 1\n```',
    changedFiles,
    labels,
    {
      existsSync: (filePath) => filePath === 'governance/evidence.json' || filePath === 'governance/schema/evidence.schema.json',
      readFile: (filePath) => (filePath === 'governance/evidence.json' ? evidenceJson : schema),
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
});
