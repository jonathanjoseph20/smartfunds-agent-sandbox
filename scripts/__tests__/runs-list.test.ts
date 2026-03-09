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
});
