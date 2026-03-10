import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from '../runs-list.ts';

const artifactsRoot = path.join('artifacts');

afterEach(() => {
  fs.rmSync(artifactsRoot, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('runs:list script', () => {
  it('T-S85-RL1 lists runs deterministically with mission IDs', async () => {
    fs.mkdirSync(path.join(artifactsRoot, 'mission-b', 'run_smartfunds-core_0002'), { recursive: true });
    fs.mkdirSync(path.join(artifactsRoot, 'mission-a', 'run_smartfunds-core_0003'), { recursive: true });
    fs.mkdirSync(path.join(artifactsRoot, 'mission-a', 'run_smartfunds-core_0001'), { recursive: true });

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main([]);

    expect(code).toBe(0);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain(
      [
        'Available Runs',
        '',
        'run_smartfunds-core_0001  mission-a',
        'run_smartfunds-core_0003  mission-a',
        'run_smartfunds-core_0002  mission-b'
      ].join('\n')
    );
  });

  it('T-S85-RL2 ignores noise directories and files', async () => {
    fs.mkdirSync(path.join(artifactsRoot, 'mission-a', 'tmp'), { recursive: true });
    fs.mkdirSync(path.join(artifactsRoot, 'mission-a', 'run_smartfunds-core_0007'), { recursive: true });
    fs.writeFileSync(path.join(artifactsRoot, 'mission-a', '.DS_Store'), 'x', 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main([]);

    expect(code).toBe(0);
    const out = stdout.mock.calls.map((call) => String(call[0])).join('');
    expect(out).toContain('run_smartfunds-core_0007  mission-a');
    expect(out).not.toContain('tmp');
  });

  it('T-S85-RL3 prints helpful empty-state and exits 0 when artifacts is missing', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main([]);

    expect(code).toBe(0);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain(
      'No runs found. Artifacts directory is missing or empty.'
    );
  });

  it('T-SPB-RL4 includes profile and execution path from run metadata when available', async () => {
    const runId = 'run_smartfunds-core_0009';
    const runDir = path.join(artifactsRoot, 'lite-mission', runId);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'run-metadata.json'), JSON.stringify({
      profile: 'lite',
      executionPath: 'lite',
      status: 'completed',
      artifactCount: 2
    }), 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main([]);
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((call) => String(call[0])).join('');
    expect(out).toContain('profile=lite');
    expect(out).toContain('path=lite');
    expect(out).toContain('status=completed');
    expect(out).toContain('artifacts=2');
  });

  it('T-SPC-RL5 includes branch and PR metadata for build runs', async () => {
    const runId = 'run_smartfunds-core_0010';
    const runDir = path.join(artifactsRoot, 'build-mission', runId);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'run-metadata.json'), JSON.stringify({
      profile: 'build',
      executionPath: 'build',
      status: 'completed',
      artifactCount: 0,
      branchName: 'build/build-mission/abc123',
      prNumber: 77
    }), 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main([]);
    expect(code).toBe(0);
    const out = stdout.mock.calls.map((call) => String(call[0])).join('');
    expect(out).toContain('profile=build');
    expect(out).toContain('path=build');
    expect(out).toContain('branch=build/build-mission/abc123');
    expect(out).toContain('pr=77');
  });
});
