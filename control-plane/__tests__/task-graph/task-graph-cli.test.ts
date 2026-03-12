import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as evaluateMain } from '../../cli/task-graph-evaluate.ts';
import { main as historyMain } from '../../cli/task-graph-history.ts';
import { main as inspectMain } from '../../cli/task-graph-inspect.ts';
import { main as listMain } from '../../cli/task-graph-list.ts';
import { main as materializeMain } from '../../cli/task-graph-materialize.ts';
import { main as statusMain } from '../../cli/task-graph-status.ts';

const {
  listTaskGraphs,
  inspectTaskGraph,
  taskGraphStatus,
  taskGraphHistory,
  evaluateTaskGraph,
  materializeTaskGraph,
} = vi.hoisted(() => ({
  listTaskGraphs: vi.fn(() => [{ taskGraphId: 'tg-1', missionId: 'm-1', nodeCount: 1, graphState: 'ready_for_execution' }]),
  inspectTaskGraph: vi.fn(() => ({ taskGraphId: 'tg-1' })),
  taskGraphStatus: vi.fn(() => ({ taskGraphId: 'tg-1', graphState: 'ready_for_execution' })),
  taskGraphHistory: vi.fn(() => ({ taskGraphId: 'tg-1', entries: [] })),
  evaluateTaskGraph: vi.fn(() => ({ taskGraphId: 'tg-1', executionEngineRunId: 'er-1' })),
  materializeTaskGraph: vi.fn(() => ({ taskGraphId: 'tg-1' })),
}));

vi.mock('../../task-graph/task-graph-inspection.ts', () => ({
  createTaskGraphInspection: vi.fn(() => ({
    listTaskGraphs,
    inspectTaskGraph,
    taskGraphStatus,
    taskGraphHistory,
    evaluateTaskGraph,
    materializeTaskGraph,
  })),
}));

describe('task graph CLI commands', () => {
  it('T-MTG-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listTaskGraphs())}\n`);
    stdout.mockRestore();
  });

  it('T-MTG-CLI2 inspect requires --graph', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --graph');
    stdout.mockRestore();
  });

  it('T-MTG-CLI3 status, history, materialize route graph argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await statusMain(['--graph', 'tg-1']);
    await historyMain(['--graph=tg-1']);
    await materializeMain(['--graph', 'tg-1']);

    expect(taskGraphStatus).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    expect(taskGraphHistory).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    expect(materializeTaskGraph).toHaveBeenCalledWith({ taskGraphId: 'tg-1' });
    stdout.mockRestore();
  });

  it('T-MTG-CLI4 evaluate requires --engine-run', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await evaluateMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --engine-run');
    stdout.mockRestore();
  });

  it('T-MTG-CLI5 evaluate routes --engine-run argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await evaluateMain(['--engine-run', 'er-1']);

    expect(code).toBe(0);
    expect(evaluateTaskGraph).toHaveBeenCalledWith({ executionEngineRunId: 'er-1' });
    stdout.mockRestore();
  });

  it('T-MTG-CLI6 stable error payload shape is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectTaskGraph.mockImplementationOnce(() => {
      throw new Error('TASK_GRAPH_NOT_FOUND');
    });

    const code = await inspectMain(['--graph', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'TASK_GRAPH_NOT_FOUND' })}\n`);
    stdout.mockRestore();
  });
});
