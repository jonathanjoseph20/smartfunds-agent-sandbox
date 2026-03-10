import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DEFAULT_ALLOWLIST, verifyWorkflows } from './verify-workflows.ts';

const tempDirs: string[] = [];

function makeRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-workflows-'));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, '.github', 'workflows'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'control-plane', 'cli'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'control-plane'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'control-plane', 'validate-pr.ts'), 'export {};\n', 'utf8');
  fs.writeFileSync(path.join(dir, 'control-plane', 'cli', 'governance-emit-ci.ts'), 'export {};\n', 'utf8');
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('verifyWorkflows', () => {
  it('parses valid workflow files and accepts allowlisted entrypoints', () => {
    const repo = makeRepo();
    fs.writeFileSync(
      path.join(repo, '.github', 'workflows', 'governance-full.yml'),
      [
        'name: Governance Full',
        'on:',
        '  pull_request:',
        '    types: [opened]',
        'jobs:',
        '  policy_full:',
        '    runs-on: ubuntu-latest',
        '    steps:',
        '      - name: Detect profile',
        '        run: node --experimental-strip-types control-plane/validate-pr.ts --mode route',
        '      - name: Validate',
        '        run: |',
          '          node --experimental-strip-types control-plane/validate-pr.ts --mode full'
      ].join('\n'),
      'utf8'
    );

    const result = verifyWorkflows({ repoRoot: repo, allowlist: [...DEFAULT_ALLOWLIST] });
    expect(result.failures).toEqual([]);
    expect(result.filesChecked).toBe(1);
  });

  it('fails invalid workflow YAML', () => {
    const repo = makeRepo();
    fs.writeFileSync(
      path.join(repo, '.github', 'workflows', 'broken.yml'),
      [
        'name: Broken',
        'jobs:',
        '  policy_full:',
        '\tsteps:',
        '      - run: npm ci'
      ].join('\n'),
      'utf8'
    );

    const result = verifyWorkflows({ repoRoot: repo, allowlist: [...DEFAULT_ALLOWLIST] });
    expect(result.failures.some((failure) => failure.type === 'parse')).toBe(true);
  });

  it('fails when a referenced node entrypoint is missing', () => {
    const repo = makeRepo();
    fs.writeFileSync(
      path.join(repo, '.github', 'workflows', 'missing.yml'),
      [
        'name: Missing Entrypoint',
        'jobs:',
        '  policy_full:',
        '    steps:',
        '      - name: Missing',
        '        run: node --experimental-strip-types control-plane/cli/does-not-exist.ts'
      ].join('\n'),
      'utf8'
    );

    const result = verifyWorkflows({ repoRoot: repo, allowlist: [...DEFAULT_ALLOWLIST] });
    const missingFailure = result.failures.find((failure) => failure.type === 'missing');
    expect(missingFailure?.entrypoint).toBe('control-plane/cli/does-not-exist.ts');
  });

  it('fails when a referenced node entrypoint is not allowlisted', () => {
    const repo = makeRepo();
    fs.writeFileSync(path.join(repo, 'control-plane', 'cli', 'other.ts'), 'export {};\n', 'utf8');
    fs.writeFileSync(
      path.join(repo, '.github', 'workflows', 'disallowed.yml'),
      [
        'name: Disallowed Entrypoint',
        'jobs:',
        '  policy_full:',
        '    steps:',
        '      - name: Disallowed',
        '        run: node --experimental-strip-types control-plane/cli/other.ts'
      ].join('\n'),
      'utf8'
    );

    const result = verifyWorkflows({ repoRoot: repo, allowlist: [...DEFAULT_ALLOWLIST] });
    const disallowedFailure = result.failures.find((failure) => failure.type === 'disallowed');
    expect(disallowedFailure?.entrypoint).toBe('control-plane/cli/other.ts');
  });
});
