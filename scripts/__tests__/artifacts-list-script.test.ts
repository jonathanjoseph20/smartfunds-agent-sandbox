import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from '../artifacts-list.ts';

const missionId = 's85-artifacts-script';
const runId = 'run_s85_script_0001';
const runDir = path.join('artifacts', missionId, runId);

afterEach(() => {
  fs.rmSync(path.join('artifacts', missionId), { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('artifacts:list root script contract', () => {
  it('T-S85-S1 root package exposes artifacts:list script', () => {
    const rootPackage = JSON.parse(fs.readFileSync(path.join('.', 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(rootPackage.scripts?.['artifacts:list']).toBe('node --experimental-strip-types scripts/artifacts-list.ts');
  });

  it('T-S85-S2 prints deterministic sorted plain-text artifact list by run', async () => {
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'zeta.json'), '{}\n', 'utf8');
    fs.writeFileSync(path.join(runDir, 'alpha.csv'), 'a,b\n', 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main(['--run', runId]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenNthCalledWith(1, `Artifacts for ${runId}\n\n`);
    expect(stdout).toHaveBeenNthCalledWith(2, 'alpha.csv\n');
    expect(stdout).toHaveBeenNthCalledWith(3, 'zeta.json\n');
  });
});

