import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './swarm-status.ts';

const getSwarmRunStatus = vi.fn();

vi.mock('../swarm/swarm-runner.ts', () => ({
  createSwarmRunner: vi.fn(() => ({
    getSwarmRunStatus
  }))
}));

describe('swarm-status CLI', () => {
  it('prints deterministic status output and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    getSwarmRunStatus.mockReturnValueOnce({
      runId: 'run_control-plane_0001',
      projectId: 'control-plane',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'swarm',
      status: 'running',
      currentPhase: 'implement',
      completedPhases: ['plan', 'setup'],
      phaseSummaries: [],
      taskSummaries: [],
      eventCount: 10
    });

    const code = await main(['--run=run_control-plane_0001']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      runId: 'run_control-plane_0001',
      projectId: 'control-plane',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'swarm',
      status: 'running',
      currentPhase: 'implement',
      completedPhases: ['plan', 'setup'],
      phaseSummaries: [],
      taskSummaries: [],
      eventCount: 10
    })}\n`);

    stdout.mockRestore();
  });

  it('returns error for missing run argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --run' })}\n`);

    stdout.mockRestore();
  });
});
