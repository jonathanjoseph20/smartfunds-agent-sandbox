import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as listMain } from '../../cli/task-execution-list.ts';
import { main as inspectMain } from '../../cli/task-execution-inspect.ts';
import { main as statusMain } from '../../cli/task-execution-status.ts';
import { main as historyMain } from '../../cli/task-execution-history.ts';
import { main as stepMain } from '../../cli/task-execution-step.ts';
import { main as failNodeMain } from '../../cli/task-execution-fail-node.ts';
import { main as retryNodeMain } from '../../cli/task-execution-retry-node.ts';
import { main as retryStatusMain } from '../../cli/task-execution-retry-status.ts';
import { main as retryHistoryMain } from '../../cli/task-execution-retry-history.ts';
import { main as advanceMain } from '../../cli/task-execution-advance.ts';
import { main as simulateMain } from '../../cli/task-execution-simulate.ts';
import { main as materializeMain } from '../../cli/task-execution-materialize.ts';

const {
  listTaskExecutionRuns,
  inspectTaskExecutionRun,
  taskExecutionStatus,
  taskExecutionHistory,
  stepTaskExecution,
  failTaskNode,
  retryTaskNode,
  retryTaskExecutionStatus,
  retryTaskExecutionHistory,
  advanceTaskExecution,
  simulateTaskExecution,
  materializeTaskExecution,
} = vi.hoisted(() => ({
  listTaskExecutionRuns: vi.fn(() => [{ executionEngineRunId: 'er-1', taskGraphId: 'tg-1' }]),
  inspectTaskExecutionRun: vi.fn(() => ({ taskGraphId: 'tg-1' })),
  taskExecutionStatus: vi.fn(() => ({ taskGraphId: 'tg-1', graphState: 'pending' })),
  taskExecutionHistory: vi.fn(() => ({ taskGraphId: 'tg-1', entries: [] })),
  stepTaskExecution: vi.fn(() => ({ taskGraphId: 'tg-1', selectedTaskNodeId: 'node-a' })),
  failTaskNode: vi.fn(() => ({ failureClass: 'RETRYABLE_FAILURE', projection: { nodeStates: { 'node-a': 'failed' } } })),
  retryTaskNode: vi.fn(() => ({ retryScheduled: true, retryStarted: true, projection: { nodeStates: { 'node-a': 'ready' }, graphState: 'running' } })),
  retryTaskExecutionStatus: vi.fn(() => ({ taskGraphId: 'tg-1', retryAttempts: [] })),
  retryTaskExecutionHistory: vi.fn(() => ({ taskGraphId: 'tg-1', entries: [] })),
  advanceTaskExecution: vi.fn(() => ({ taskGraphId: 'tg-1', mode: 'advance' })),
  simulateTaskExecution: vi.fn(() => ({ taskGraphId: 'tg-1', mode: 'simulate' })),
  materializeTaskExecution: vi.fn(() => ({ taskGraphId: 'tg-1' })),
}));

vi.mock('../../task-execution/task-execution-inspection.ts', () => ({
  createTaskExecutionInspection: vi.fn(() => ({
    listTaskExecutionRuns,
    inspectTaskExecutionRun,
    taskExecutionStatus,
    taskExecutionHistory,
    stepTaskExecution,
    failTaskNode,
    retryTaskNode,
    retryTaskExecutionStatus,
    retryTaskExecutionHistory,
    advanceTaskExecution,
    simulateTaskExecution,
    materializeTaskExecution,
  })),
}));

describe('task execution CLI commands', () => {
  it('T-MTE-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listTaskExecutionRuns())}\n`);
    stdout.mockRestore();
  });

  it('T-MTE-CLI2 inspect requires --graph', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'TASK_EXECUTION_ARGUMENT_MISSING_GRAPH' })}\n`);
    stdout.mockRestore();
  });

  it('T-MTE-CLI3 routes graph argument to all graph-scoped commands', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await statusMain(['--graph', 'tg-1']);
    await historyMain(['--graph=tg-1']);
    await stepMain(['--graph', 'tg-1']);
    await failNodeMain(['--graph', 'tg-1', '--node', 'node-a']);
    await retryNodeMain(['--graph', 'tg-1', '--node=node-a']);
    await retryStatusMain(['--graph=tg-1']);
    await retryHistoryMain(['--graph', 'tg-1']);
    await advanceMain(['--graph', 'tg-1']);
    await simulateMain(['--graph=tg-1']);
    await materializeMain(['--graph', 'tg-1']);

    expect(taskExecutionStatus).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    expect(taskExecutionHistory).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    expect(stepTaskExecution).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    expect(failTaskNode).toHaveBeenCalledWith({ taskGraphId: 'tg-1', taskNodeId: 'node-a' });
    expect(retryTaskNode).toHaveBeenCalledWith({ taskGraphId: 'tg-1', taskNodeId: 'node-a' });
    expect(retryTaskExecutionStatus).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    expect(retryTaskExecutionHistory).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    expect(advanceTaskExecution).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    expect(simulateTaskExecution).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    expect(materializeTaskExecution).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    stdout.mockRestore();
  });

  it('T-MTE-CLI4 stable error payload shape is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectTaskExecutionRun.mockImplementationOnce(() => {
      throw new Error('TASK_EXECUTION_RUN_NOT_FOUND');
    });

    const code = await inspectMain(['--graph', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'TASK_EXECUTION_RUN_NOT_FOUND' })}\n`);
    stdout.mockRestore();
  });
});
