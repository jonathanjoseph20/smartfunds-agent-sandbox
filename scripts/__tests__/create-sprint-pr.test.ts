import { describe, expect, it, vi } from 'vitest';

import { buildCanonicalLabels, parseArgs, runCreateSprintPr } from '../create-sprint-pr.ts';

const VALID_BODY = [
  'tier-1',
  '',
  '```evidence',
  'Risk Tier: 1',
  'Justification: test',
  'Affected Paths: docs/readme.md',
  'Tests Added: yes',
  'Determinism Statement: Deterministic.',
  '```',
  ''
].join('\n');

describe('create-sprint-pr', () => {
  it('builds deterministic label content', () => {
    expect(buildCanonicalLabels(1, ['codex', 'tier-2'])).toBe('codex\ntier-1');
    expect(buildCanonicalLabels(2)).toBe('tier-2');
  });

  it('parses helper args and requires tier', () => {
    expect(() => parseArgs([])).toThrow('Missing required --tier');
    expect(parseArgs(['--tier', '1', '--no-create'])).toEqual({
      tier: 1,
      title: undefined,
      create: false,
      bootstrapLabels: true
    });
  });

  it('runs deterministic generation flow and writes canonical labels', () => {
    const calls: Array<{ command: string; args: string[] }> = [];
    const execFileSyncImpl = vi.fn((command: string, args: string[]) => {
      calls.push({ command, args });
      if (command === 'npm') {
        return '';
      }
      return '';
    });

    const writes: Array<{ path: string; content: string }> = [];
    runCreateSprintPr(['--tier', '1', '--no-create'], {
      execFileSyncImpl: execFileSyncImpl as unknown as typeof import('node:child_process').execFileSync,
      existsSyncImpl: vi.fn((path: string) => path === '.pr-labels.txt') as unknown as typeof import('node:fs').existsSync,
      readFileSyncImpl: vi.fn((path: string) => (path === '.pr-labels.txt' ? 'codex\n' : VALID_BODY)) as unknown as typeof import('node:fs').readFileSync,
      writeFileSyncImpl: vi.fn((path: string, content: string) => {
        writes.push({ path, content });
      }) as unknown as typeof import('node:fs').writeFileSync
    });

    expect(writes[0]).toEqual({
      path: '.pr-labels.txt',
      content: 'codex\ntier-1\n'
    });
    expect(calls.map((entry) => `${entry.command} ${entry.args.join(' ')}`)).toEqual([
      'npm run governance:generate -- --tier 1 --out .pr-body.md',
      'npm run governance:normalize -- .pr-body.md',
      'npm run governance:preflight',
      'npm run pr:body:check -- --body-file .pr-body.md',
      'npm run bootstrap:labels -- --yes'
    ]);
  });

  it('fails when generated body does not satisfy tier/evidence contract', () => {
    const execFileSyncImpl = vi.fn(() => '');

    expect(() => runCreateSprintPr(['--tier', '1', '--no-create'], {
      execFileSyncImpl: execFileSyncImpl as unknown as typeof import('node:child_process').execFileSync,
      existsSyncImpl: vi.fn(() => false) as unknown as typeof import('node:fs').existsSync,
      readFileSyncImpl: vi.fn((path: string) => (path === '.pr-body.md' ? 'tier-1\n\n```\ninvalid\n```' : '')) as unknown as typeof import('node:fs').readFileSync,
      writeFileSyncImpl: vi.fn() as unknown as typeof import('node:fs').writeFileSync
    })).toThrow('Missing evidence fence');
  });
});
