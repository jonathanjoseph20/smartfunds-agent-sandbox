import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { runGovernanceEmitCi } from './governance-emit-ci.ts';
import { runGovernanceValidation } from '../governance/validate.ts';

const tempDirs: string[] = [];

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gov-emit-ci-'));
  tempDirs.push(dir);
  return dir;
}

function withMockedEvidence(evidenceContent: string, run: () => Promise<void>): Promise<void> {
  const originalExistsSync = fs.existsSync.bind(fs);
  const originalReadFileSync = fs.readFileSync.bind(fs);
  const schema = originalReadFileSync('governance/schema/evidence.schema.json', 'utf8');

  vi.spyOn(fs, 'existsSync').mockImplementation((filePath: fs.PathLike) => {
    const normalized = String(filePath);
    if (normalized === 'governance/evidence.json' || normalized === 'governance/schema/evidence.schema.json') {
      return true;
    }
    return originalExistsSync(filePath);
  });

  vi.spyOn(fs, 'readFileSync').mockImplementation(
    (filePath: fs.PathOrFileDescriptor, options?: BufferEncoding | { encoding?: BufferEncoding | null; flag?: string } | null) => {
      const normalized = String(filePath);
      if (normalized === 'governance/evidence.json') {
        return evidenceContent;
      }
      if (normalized === 'governance/schema/evidence.schema.json') {
        return schema;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return originalReadFileSync(filePath as any, options as any);
    }
  );

  return run().finally(() => {
    vi.restoreAllMocks();
  });
}

afterEach(() => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_REPOSITORY;
  delete process.env.GITHUB_EVENT_PATH;
});

describe('governance:emit:ci', () => {
  it('T-L1 emits canonical evidence and deterministic hash from mocked GitHub API metadata', async () => {
    const dir = makeTempDir();
    const eventPath = path.join(dir, 'event.json');
    const outFile = path.join(dir, 'evidence.json');
    fs.writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: 70
        },
        number: 70
      }),
      'utf8'
    );

    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_EVENT_PATH = eventPath;

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/pulls/70')) {
        return new Response(
          JSON.stringify({
            body: 'tier-3',
            labels: [{ name: 'tier-3' }, { name: 'codex' }]
          }),
          { status: 200 }
        );
      }
      if (url.includes('/pulls/70/files')) {
        return new Response(
          JSON.stringify([{ filename: 'control-plane/governance/validate.ts' }]),
          { status: 200 }
        );
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    fs.writeFileSync(
      outFile,
      '{\n  "tier": 3,\n  "mode": "structured",\n  "affectedPaths": [\n    "control-plane/governance/validate.ts"\n  ],\n  "determinismStatement": "Deterministic evidence generation from PR metadata using canonical JSON and stable ordering.",\n  "retrySemanticsModified": false,\n  "autonomyScopeExpanded": false\n}\n',
      'utf8'
    );

    const first = await runGovernanceEmitCi(['--out-file', outFile]);
    const second = await runGovernanceEmitCi(['--out-file', outFile]);

    expect(first.evidenceHash).toBe(second.evidenceHash);
    expect(fs.readFileSync(outFile, 'utf8')).toContain('"affectedPaths"');
  });

  it('T-L1 prints stable Evidence SHA line', async () => {
    const dir = makeTempDir();
    const eventPath = path.join(dir, 'event.json');
    const outFile = path.join(dir, 'evidence.json');
    fs.writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: 75
        },
        number: 75
      }),
      'utf8'
    );

    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_EVENT_PATH = eventPath;

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/pulls/75')) {
        return new Response(
          JSON.stringify({
            body: 'tier-2',
            labels: [{ name: 'tier-2' }]
          }),
          { status: 200 }
        );
      }
      if (url.includes('/pulls/75/files')) {
        return new Response(JSON.stringify([{ filename: 'apps/api/src/index.ts' }]), { status: 200 });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    fs.writeFileSync(
      outFile,
      '{\n  "tier": 2,\n  "mode": "autonomous",\n  "affectedPaths": [\n    "apps/api/src/index.ts"\n  ],\n  "determinismStatement": "Deterministic evidence generation from PR metadata using canonical JSON and stable ordering.",\n  "retrySemanticsModified": false,\n  "autonomyScopeExpanded": false\n}\n',
      'utf8'
    );

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await runGovernanceEmitCi(['--out-file', outFile]);
    const evidenceLine = logSpy.mock.calls
      .map(([line]) => String(line))
      .find((line) => line.startsWith('Evidence SHA: '));

    expect(evidenceLine).toMatch(/^Evidence SHA: [0-9a-f]{64}$/);
    logSpy.mockRestore();
  });

  it('T-L1 reports deterministic remediation when evidence drift is detected', async () => {
    const dir = makeTempDir();
    const eventPath = path.join(dir, 'event.json');
    const outFile = path.join(dir, 'evidence.json');
    fs.writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: 71
        },
        number: 71
      }),
      'utf8'
    );

    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_EVENT_PATH = eventPath;

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/pulls/71')) {
        return new Response(
          JSON.stringify({
            body: 'tier-2',
            labels: [{ name: 'tier-2' }]
          }),
          { status: 200 }
        );
      }
      if (url.includes('/pulls/71/files')) {
        return new Response(JSON.stringify([{ filename: 'apps/api/src/index.ts' }]), { status: 200 });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    fs.writeFileSync(outFile, '{ "tier": 0 }\n', 'utf8');

    await expect(runGovernanceEmitCi(['--out-file', outFile])).rejects.toThrow(
      'Evidence drift detected. Run: npm run governance:emit && git add governance/evidence.json && git commit -m "fix(governance): emit canonical evidence"'
    );
  });

  it('T-L1 integration validates full mode after emit:ci with mocked API metadata', async () => {
    const dir = makeTempDir();
    const eventPath = path.join(dir, 'event.json');
    const outFile = path.join(dir, 'evidence.json');
    fs.writeFileSync(
      eventPath,
      JSON.stringify({
        pull_request: {
          number: 72
        },
        number: 72
      }),
      'utf8'
    );

    process.env.GITHUB_TOKEN = 'test-token';
    process.env.GITHUB_REPOSITORY = 'owner/repo';
    process.env.GITHUB_EVENT_PATH = eventPath;

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.endsWith('/pulls/72')) {
        return new Response(
          JSON.stringify({
            body:
              'tier-2\\n\\n```evidence\\nRisk Tier: 2\\nJustification: ok\\nAffected Paths: apps/api/src/index.ts\\nTests Added: npm test\\nDeterminism Statement: deterministic\\n```',
            labels: [{ name: 'tier-2' }]
          }),
          { status: 200 }
        );
      }
      if (url.includes('/pulls/72/files')) {
        return new Response(JSON.stringify([{ filename: 'apps/api/src/index.ts' }]), { status: 200 });
      }
      return new Response('', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    fs.writeFileSync(
      outFile,
      '{\n  "tier": 2,\n  "mode": "autonomous",\n  "affectedPaths": [\n    "apps/api/src/index.ts"\n  ],\n  "determinismStatement": "Deterministic evidence generation from PR metadata using canonical JSON and stable ordering.",\n  "retrySemanticsModified": false,\n  "autonomyScopeExpanded": false\n}\n',
      'utf8'
    );

    await runGovernanceEmitCi(['--out-file', outFile]);
    const emitted = fs.readFileSync(outFile, 'utf8');

    await withMockedEvidence(emitted, async () => {
      const result = await runGovernanceValidation({
        mode: 'full',
        token: 'test-token',
        repository: 'owner/repo',
        eventPath,
        fetchImpl: fetchMock
      });

      expect(result.errors.join('\n')).not.toContain('Evidence drift detected');
      expect(result.report.labelTier).toBe(2);
    });
  });

  it('T-L1 requires --pr for local usage when no pull_request event metadata is available', async () => {
    const dir = makeTempDir();
    const outFile = path.join(dir, 'evidence.json');
    fs.writeFileSync(outFile, '{ "tier": 0 }\n', 'utf8');

    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPOSITORY;
    delete process.env.GITHUB_EVENT_PATH;

    await expect(runGovernanceEmitCi(['--out-file', outFile])).rejects.toThrow(
      'Missing pull request number. Provide --pr <N> when GITHUB_EVENT_PATH is unavailable or missing pull_request metadata.'
    );
    await expect(runGovernanceEmitCi(['--out-file', outFile])).rejects.toThrow(
      'npm run governance:emit:ci -- --pr 73'
    );
    await expect(runGovernanceEmitCi(['--out-file', outFile])).rejects.toThrow(
      'npm run governance:emit:ci:local -- 73'
    );
  });
});
