import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from '../artifacts-view.ts';

const base = path.join('artifacts');

afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('artifacts:view script', () => {
  it('T-S85-AV1 prints report, dataset preview, and other artifacts for a valid run', async () => {
    const runId = 'run_smartfunds-core_1200';
    const runDir = path.join(base, 'rwa-market-analysis', runId);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'report.md'), '# Mission Report\nStatus: completed\n', 'utf8');
    fs.writeFileSync(path.join(runDir, 'dataset.csv'), 'a,b\n1,2\n3,4\n', 'utf8');
    fs.writeFileSync(path.join(runDir, 'research-pages.json'), '{}\n', 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main(['--run', runId]);

    expect(code).toBe(0);
    const out = stdout.mock.calls.map((call) => String(call[0])).join('');

    expect(out).toContain('=== REPORT ===');
    expect(out).toContain(`Run ID: ${runId}`);
    expect(out).toContain('# Mission Report');
    expect(out).toContain('=== DATASET ===');
    expect(out).toContain('a,b');
    expect(out).toContain('=== OTHER ARTIFACTS ===');
    expect(out).toContain('research-pages.json');
  });

  it('T-S85-AV2 returns non-zero when run is missing', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main(['--run', 'run_smartfunds-core_missing']);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('ARTIFACT_RUN_NOT_FOUND');
  });

  it('T-S85-AV3 returns non-zero when run has multiple mission matches', async () => {
    const runId = 'run_smartfunds-core_dup';
    fs.mkdirSync(path.join(base, 'mission-a', runId), { recursive: true });
    fs.mkdirSync(path.join(base, 'mission-b', runId), { recursive: true });

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main(['--run', runId]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('ARTIFACT_RUN_AMBIGUOUS');
  });
});
