import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './swarm-create.ts';

const createSwarmRun = vi.fn();

vi.mock('../swarm/swarm-runner.ts', () => ({
  createSwarmRunner: vi.fn(() => ({
    createSwarmRun
  }))
}));

describe('swarm-create CLI', () => {
  it('prints deterministic summary output and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    createSwarmRun.mockReturnValueOnce({
      runId: 'run_control-plane_0001',
      projectId: 'control-plane',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'swarm',
      status: 'created',
      currentPhase: 'plan',
      completedPhases: [],
      phaseSummaries: [],
      taskSummaries: [],
      eventCount: 1
    });

    const code = await main(['--project', 'control-plane']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      runId: 'run_control-plane_0001',
      projectId: 'control-plane',
      entity: 'core-entity',
      pod: 'smartfunds',
      mode: 'structured',
      kind: 'swarm',
      status: 'created',
      currentPhase: 'plan',
      completedPhases: [],
      phaseSummaries: [],
      taskSummaries: [],
      eventCount: 1
    })}\n`);

    stdout.mockRestore();
  });

  it('prints stable error payload for missing project argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --project' })}\n`);

    stdout.mockRestore();
  });
});
