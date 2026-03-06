import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './swarm-run.ts';

const executeSwarmRun = vi.fn();

vi.mock('../swarm/swarm-runner.ts', () => ({
  createSwarmRunner: vi.fn(() => ({
    executeSwarmRun
  }))
}));

describe('swarm-run CLI', () => {
  it('prints deterministic execution summary and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    executeSwarmRun.mockReturnValueOnce({
      runId: 'run_control-plane_0001',
      projectId: 'control-plane',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'swarm',
      status: 'completed',
      currentPhase: 'release',
      completedPhases: ['plan', 'setup', 'implement', 'verify', 'test', 'release'],
      phaseSummaries: [],
      taskSummaries: [],
      eventCount: 27
    });

    const code = await main(['--run', 'run_control-plane_0001']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      runId: 'run_control-plane_0001',
      projectId: 'control-plane',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'swarm',
      status: 'completed',
      currentPhase: 'release',
      completedPhases: ['plan', 'setup', 'implement', 'verify', 'test', 'release'],
      phaseSummaries: [],
      taskSummaries: [],
      eventCount: 27
    })}\n`);

    stdout.mockRestore();
  });

  it('prints stable error for invalid arguments and exits 1', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main(['--project', 'control-plane']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --project' })}\n`);

    stdout.mockRestore();
  });
});
