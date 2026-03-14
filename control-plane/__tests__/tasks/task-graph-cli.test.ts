import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as createMain } from '../../cli/implementation-task-graph-create.ts';
import { main as inspectMain } from '../../cli/implementation-task-graph-inspect.ts';
import { main as listMain } from '../../cli/implementation-task-graph-list.ts';
import { main as materializeMain } from '../../cli/implementation-task-graph-materialize.ts';

const {
  createTaskGraph,
  listTaskGraphs,
  inspectTaskGraph,
  materializeTaskGraph,
} = vi.hoisted(() => ({
  createTaskGraph: vi.fn(() => ({
    taskGraphId: 'tg-1',
    planId: 'plan-1',
    specId: 'spec-1',
    status: 'ready',
  })),
  listTaskGraphs: vi.fn(() => ([
    {
      taskGraphId: 'tg-1',
      planId: 'plan-1',
      specId: 'spec-1',
      status: 'ready',
      nodeCount: 1,
      edgeCount: 0,
    },
  ])),
  inspectTaskGraph: vi.fn(() => ({
    taskGraphId: 'tg-1',
    planId: 'plan-1',
    specId: 'spec-1',
    status: 'ready',
    nodeCount: 1,
    edgeCount: 0,
    planValidationState: 'valid',
    planMissingFields: [],
    planConstraintViolations: [],
    graphConstraintViolations: [],
    historySummary: { totalEvents: 1 },
    artifactPaths: {
      dirPath: 'artifacts/tasks/tg-1',
      graphPath: 'artifacts/tasks/tg-1/implementation-task-graph.json',
      statusPath: 'artifacts/tasks/tg-1/implementation-task-graph-status.json',
      historyPath: 'artifacts/tasks/tg-1/implementation-task-graph-history.json',
      reportPath: 'artifacts/tasks/tg-1/implementation-task-graph-report.md',
      nodesPath: 'artifacts/tasks/tg-1/implementation-task-graph-nodes.json',
      edgesPath: 'artifacts/tasks/tg-1/implementation-task-graph-edges.json',
    },
  })),
  materializeTaskGraph: vi.fn(() => ({
    taskGraphId: 'tg-1',
    planId: 'plan-1',
    specId: 'spec-1',
    graphPath: 'artifacts/tasks/tg-1/implementation-task-graph.json',
    statusPath: 'artifacts/tasks/tg-1/implementation-task-graph-status.json',
    historyPath: 'artifacts/tasks/tg-1/implementation-task-graph-history.json',
    reportPath: 'artifacts/tasks/tg-1/implementation-task-graph-report.md',
    nodesPath: 'artifacts/tasks/tg-1/implementation-task-graph-nodes.json',
    edgesPath: 'artifacts/tasks/tg-1/implementation-task-graph-edges.json',
  })),
}));

vi.mock('../../tasks/task-graph-inspection.ts', () => ({
  createImplementationTaskGraphInspection: vi.fn(() => ({
    createTaskGraph,
    listTaskGraphs,
    inspectTaskGraph,
    materializeTaskGraph,
  })),
}));

describe('implementation task graph CLI', () => {
  it('T-PF3-CLI1 create/list/inspect/materialize output canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain(['--plan', 'plan-1'])).toBe(0);
    expect(await listMain([])).toBe(0);
    expect(await inspectMain(['--graph', 'tg-1'])).toBe(0);
    expect(await materializeMain(['--graph', 'tg-1'])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      taskGraphId: 'tg-1',
      status: 'ready',
      planId: 'plan-1',
      specId: 'spec-1',
    })}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listTaskGraphs())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectTaskGraph())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeTaskGraph())}\n`);

    stdout.mockRestore();
  });

  it('T-PF3-CLI2 returns code 1 with canonical error payload for input errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain([])).toBe(1);
    expect(await inspectMain([])).toBe(1);
    expect(await materializeMain([])).toBe(1);
    expect(await listMain(['--bad'])).toBe(1);

    const merged = stdout.mock.calls.map((entry) => String(entry[0])).join('');
    expect(merged).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --plan' }));
    expect(merged).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --graph' }));
    expect(merged).toContain(canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --bad' }));

    stdout.mockRestore();
  });
});
