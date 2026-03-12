import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as workersListMain } from '../../cli/workers-list.ts';
import { main as workersInspectMain } from '../../cli/workers-inspect.ts';
import { main as workersStatusMain } from '../../cli/workers-status.ts';
import { main as claimMain } from '../../cli/task-execution-claim.ts';
import { main as workerStatusMain } from '../../cli/task-execution-worker-status.ts';

const {
  workersList,
  workersInspect,
  workersStatus,
  taskExecutionClaim,
  taskExecutionWorkerStatus,
} = vi.hoisted(() => ({
  workersList: vi.fn(() => [{ workerId: 'default-local-worker' }]),
  workersInspect: vi.fn(() => ({ workerId: 'default-local-worker' })),
  workersStatus: vi.fn(() => ({ totalWorkers: 1 })),
  taskExecutionClaim: vi.fn(() => ({ claim: { claimId: 'c-1' }, appended: true })),
  taskExecutionWorkerStatus: vi.fn(() => ({ taskGraphId: 'tg-1', claimedNodeCount: 1 })),
}));

vi.mock('../../task-execution/task-execution-inspection.ts', () => ({
  createTaskExecutionInspection: vi.fn(() => ({
    workersList,
    workersInspect,
    workersStatus,
    taskExecutionClaim,
    taskExecutionWorkerStatus,
  })),
}));

describe('task workers CLI', () => {
  it('T-TW-CLI1 worker commands print canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await workersListMain([])).toBe(0);
    expect(await workersInspectMain(['--worker', 'default-local-worker'])).toBe(0);
    expect(await workersStatusMain([])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(workersList())}\n`);
    stdout.mockRestore();
  });

  it('T-TW-CLI2 claim and worker-status route graph args correctly', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await claimMain(['--graph', 'tg-1', '--node', 'node-a', '--worker', 'default-local-worker'])).toBe(0);
    expect(await workerStatusMain(['--graph=tg-1'])).toBe(0);

    expect(taskExecutionClaim).toHaveBeenCalledWith({
      taskGraphId: 'tg-1',
      taskNodeId: 'node-a',
      workerId: 'default-local-worker',
      claimAttemptIndex: 0,
    });
    expect(taskExecutionWorkerStatus).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    stdout.mockRestore();
  });
});
