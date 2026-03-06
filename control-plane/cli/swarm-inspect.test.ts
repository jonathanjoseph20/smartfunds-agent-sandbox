import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './swarm-inspect.ts';

const inspectRun = vi.fn();
const getSwarmRunStatus = vi.fn();

vi.mock('../journal/journal.ts', () => ({
  createExecutionJournal: vi.fn(() => ({
    inspectRun
  }))
}));

vi.mock('../swarm/swarm-runner.ts', () => ({
  createSwarmRunner: vi.fn(() => ({
    getSwarmRunStatus
  }))
}));

describe('swarm-inspect CLI', () => {
  it('prints deterministic run inspection output and exits 0', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    inspectRun.mockReturnValueOnce({
      run: {
        runId: 'run_control-plane_0001'
      },
      events: [
        {
          sequence: 1,
          payload: {}
        },
        {
          sequence: 2,
          payload: {
            context_snapshot: {
              runId: 'run_control-plane_0001',
              phase: 'setup',
              taskId: 'load-run-context',
              memory: {
                b: 2,
                a: 1
              },
              artifacts: ['z.md', 'a.md'],
              metadata: {
                z: true,
                a: false
              }
            }
          }
        }
      ]
    });

    getSwarmRunStatus.mockReturnValueOnce({
      runId: 'run_control-plane_0001',
      currentPhase: 'setup',
      taskSummaries: [
        {
          taskId: 'load-run-context',
          phase: 'setup',
          status: 'completed',
          order: 1,
          description: 'Load deterministic run context'
        }
      ]
    });

    const code = await main(['--run', 'run_control-plane_0001']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      runId: 'run_control-plane_0001',
      currentPhase: 'setup',
      tasks: [
        {
          taskId: 'load-run-context',
          phase: 'setup',
          status: 'completed',
          order: 1,
          description: 'Load deterministic run context'
        }
      ],
      context: {
        memory: {
          b: 2,
          a: 1
        },
        artifacts: ['a.md', 'z.md'],
        metadata: {
          z: true,
          a: false
        }
      }
    })}\n`);

    stdout.mockRestore();
  });

  it('prints stable error for missing run and exits 1', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    inspectRun.mockImplementationOnce(() => {
      throw new Error('Run not found: run_missing_0001');
    });

    const code = await main(['--run', 'run_missing_0001']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'Run not found: run_missing_0001' })}\n`);

    stdout.mockRestore();
  });

  it('prints stable error for unknown arguments and exits 1', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main(['--project', 'control-plane']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --project' })}\n`);

    stdout.mockRestore();
  });
});
