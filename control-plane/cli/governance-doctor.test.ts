import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runGovernanceDoctor } from './governance-doctor.ts';

const tempDirs: string[] = [];
const originalCwd = process.cwd();

function makeTempRepo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-doctor-'));
  tempDirs.push(dir);
  fs.mkdirSync(path.join(dir, 'governance', 'schema'), { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'governance', 'schema', 'evidence.schema.json'),
    fs.readFileSync(path.join(originalCwd, 'governance', 'schema', 'evidence.schema.json'), 'utf8'),
    'utf8'
  );
  return dir;
}

afterEach(() => {
  process.chdir(originalCwd);
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  vi.restoreAllMocks();
  delete process.env.GITHUB_TOKEN;
  delete process.env.GH_TOKEN;
  delete process.env.GITHUB_REPOSITORY;
  delete process.env.GITHUB_EVENT_PATH;
});

describe('governance:doctor', () => {
  it('T-L1 reports drift and env remediation with deterministic commands', async () => {
    const dir = makeTempRepo();
    process.chdir(dir);
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_EVENT_PATH;
    fs.writeFileSync(
      path.join('governance', 'evidence.json'),
      '{\"tier\":2,\"mode\":\"structured\",\"affectedPaths\":[\"a.ts\"],\"determinismStatement\":\"d\",\"retrySemanticsModified\":false,\"autonomyScopeExpanded\":false}\n',
      'utf8'
    );

    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((line?: unknown) => {
      logs.push(String(line ?? ''));
    });

    const code = await runGovernanceDoctor([]);
    expect(code).toBe(1);
    expect(logs.join('\n')).toContain('❌ Evidence drift detected');
    expect(logs.join('\n')).toContain('Run: npm run governance:emit');
    expect(logs.join('\n')).toContain('git add governance/evidence.json');
    expect(logs.join('\n')).toContain('git commit -m "fix(governance): canonicalize evidence"');
    expect(logs.join('\n')).toContain('❌ Missing env vars for local full validation');
    expect(logs.join('\n')).toContain('npm run governance:validate:local -- --mode full --pr 70');
  });
});
