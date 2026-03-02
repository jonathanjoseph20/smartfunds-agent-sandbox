import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { runGovernanceCheck } from './governance-check';
import { buildCanonicalEvidence, stringifyEvidenceJson } from './governance/evidence-contract';

function makeGitExec(changedFiles: string[], branchName = 'main'): (args: string[]) => string {
  return (args) => {
    if (args[0] === 'merge-base') {
      return 'base-sha';
    }
    if (args[0] === 'rev-parse') {
      return branchName;
    }
    if (args[0] === 'diff') {
      return changedFiles.join('\n');
    }
    throw new Error(`unexpected git args: ${args.join(' ')}`);
  };
}

describe('governance:check', () => {
  it('fails with exact error when governance/evidence.json is missing', async () => {
    const result = await runGovernanceCheck({
      readFile: () => '',
      existsSync: () => false,
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Missing governance/evidence.json');
  });

  it('fails even when PR body contains markdown-only evidence and file is missing', async () => {
    const body = `tier-1

\`\`\`evidence
Risk Tier: 1
\`\`\``;
    const result = await runGovernanceCheck({
      readFile: () => body,
      existsSync: () => false,
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Missing governance/evidence.json');
  });

  it('fails when evidence tier mismatches label tier', async () => {
    const schema = fs.readFileSync('governance/schema/evidence.schema.json', 'utf8');
    const evidence = stringifyEvidenceJson(
      buildCanonicalEvidence({
        tier: 2,
        mode: 'autonomous',
        affectedPaths: ['apps/api/src/index.ts'],
        determinismStatement: 'No identity surfaces mutated.',
        retrySemanticsModified: false,
        autonomyScopeExpanded: false
      })
    );
    const result = await runGovernanceCheck({
      readFile: (filePath) => {
        if (filePath === 'governance/evidence.json') {
          return evidence;
        }
        if (filePath === 'governance/schema/evidence.schema.json') {
          return schema;
        }
        if (filePath.endsWith('.pr-labels.txt')) {
          return 'tier-1\n';
        }
        return '';
      },
      existsSync: (filePath) =>
        filePath === 'governance/evidence.json' ||
        filePath === 'governance/schema/evidence.schema.json' ||
        filePath.endsWith('.pr-labels.txt'),
      gitExec: makeGitExec(['apps/api/src/index.ts']),
      token: '',
      repo: ''
    });

    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toContain('governance/evidence.json tier must be 1');
  });
});
