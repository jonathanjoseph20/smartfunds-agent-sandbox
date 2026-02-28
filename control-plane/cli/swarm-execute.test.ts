import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './swarm-execute.ts';

vi.mock('../swarms/swarmExecutor.ts', () => {
  return {
    runSwarmExecution: vi.fn()
  };
});

import { runSwarmExecution } from '../swarms/swarmExecutor.ts';

describe('swarm-execute CLI', () => {
  it('prints deterministic success payload and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(runSwarmExecution).mockResolvedValueOnce({
      swarmId: 'marketing-team',
      projectId: 'docs',
      executionMode: 'autonomous',
      tasksExecuted: 1,
      prCreated: true,
      branchName: 'swarm/marketing-team/run-1',
      retryEligible: true,
      deterministicHash: 'abc123'
    });

    const code = await main([
      '--swarm',
      'marketing-team',
      '--project',
      'docs',
      '--mode',
      'autonomous',
      '--intent',
      'update docs marker'
    ]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(
      `${canonicalStringify({
        swarmId: 'marketing-team',
        projectId: 'docs',
        executionMode: 'autonomous',
        tasksExecuted: 1,
        prCreated: true,
        branchName: 'swarm/marketing-team/run-1',
        retryEligible: true,
        deterministicHash: 'abc123'
      })}\n`
    );

    stdout.mockRestore();
  });

  it('returns exit 1 on deterministic validation failure', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(runSwarmExecution).mockRejectedValueOnce(new Error('BRANCH_ALREADY_EXISTS: swarm/marketing-team/run-1'));

    const code = await main([
      '--swarm=marketing-team',
      '--project=docs',
      '--mode=autonomous',
      '--intent=update docs marker'
    ]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(
      `${canonicalStringify({ error: 'BRANCH_ALREADY_EXISTS: swarm/marketing-team/run-1' })}\n`
    );

    stdout.mockRestore();
  });

  it('returns exit 2 on unexpected error', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.mocked(runSwarmExecution).mockRejectedValueOnce(new Error('boom'));

    const code = await main([
      '--swarm',
      'marketing-team',
      '--project',
      'docs',
      '--mode',
      'autonomous',
      '--intent',
      'update docs marker'
    ]);

    expect(code).toBe(2);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'unexpected_runtime_error' })}\n`);

    stdout.mockRestore();
  });
});
