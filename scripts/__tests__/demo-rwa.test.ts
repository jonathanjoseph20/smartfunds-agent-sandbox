import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from '../demo-rwa.ts';

afterEach(() => {
  fs.rmSync(path.join('artifacts'), { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('demo:rwa script', () => {
  it('T-S85-D1 runs full demo flow and prints operator summary', async () => {
    const runId = 'run_smartfunds-core_2201';
    const runDir = path.join('artifacts', 'rwa-market-analysis', runId);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, 'report.md'), '# Mission Report\nStatus: completed\n', 'utf8');
    fs.writeFileSync(path.join(runDir, 'dataset.csv'), 'agentId,missionId\na1,rwa\n', 'utf8');

    const runCommand = vi.fn((command: string, args: string[]) => {
      const joined = `${command} ${args.join(' ')}`;
      if (joined === 'npm run mission:run -- --mission rwa-market-analysis') {
        return {
          stdout: [
            '> mission:run',
            `{"missionId":"rwa-market-analysis","workflowRun":"${runId}"}`,
            ''
          ].join('\n')
        };
      }
      if (joined === `npm run workflow:run-inspect -- --run ${runId}`) {
        return {
          stdout: [
            '> workflow:run-inspect',
            JSON.stringify({
              workflow: { status: 'completed' },
              nodes: [{ nodeId: 'final-review' }, { nodeId: 'market-research' }]
            }),
            ''
          ].join('\n')
        };
      }
      if (joined === `npm run artifacts:list -- --run ${runId}`) {
        return { stdout: ['Artifacts for run', 'dataset.csv', 'report.md'].join('\n') };
      }
      throw new Error(`unexpected command: ${joined}`);
    });

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main([], { runCommand });

    expect(code).toBe(0);
    expect(runCommand).toHaveBeenCalledTimes(3);

    const out = stdout.mock.calls.map((call) => String(call[0])).join('');
    expect(out).toContain('SMARTFUNDS DEMO START');
    expect(out).toContain(`Run ID: ${runId}`);
    expect(out).toContain('Workflow Status: completed');
    expect(out).toContain('market-research');
    expect(out).toContain('--- REPORT PREVIEW ---');
    expect(out).toContain('# Mission Report');
    expect(out).toContain('--- DATASET PREVIEW ---');
    expect(out).toContain('agentId,missionId');
  });

  it('T-S85-D2 tolerates missing preview files after successful command flow', async () => {
    const runId = 'run_smartfunds-core_2202';
    const runDir = path.join('artifacts', 'rwa-market-analysis', runId);
    fs.mkdirSync(runDir, { recursive: true });

    const runCommand = vi.fn((command: string, args: string[]) => {
      const joined = `${command} ${args.join(' ')}`;
      if (joined === 'npm run mission:run -- --mission rwa-market-analysis') {
        return { stdout: JSON.stringify({ workflowRun: runId }) };
      }
      if (joined === `npm run workflow:run-inspect -- --run ${runId}`) {
        return { stdout: JSON.stringify({ workflow: { status: 'completed' }, nodes: [] }) };
      }
      if (joined === `npm run artifacts:list -- --run ${runId}`) {
        return { stdout: 'Artifacts for run\n' };
      }
      throw new Error(`unexpected command: ${joined}`);
    });

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main([], { runCommand });

    expect(code).toBe(0);
    const out = stdout.mock.calls.map((call) => String(call[0])).join('');
    expect(out).toContain('report.md not found for this run.');
    expect(out).toContain('dataset.csv not found for this run.');
  });

  it('T-S85-D3 exits non-zero when subprocess command fails', async () => {
    const runCommand = vi.fn(() => {
      throw new Error('Command failed: npm run mission:run');
    });

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const code = await main([], { runCommand });

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('DEMO_FAILED: Command failed: npm run mission:run');
  });
});
