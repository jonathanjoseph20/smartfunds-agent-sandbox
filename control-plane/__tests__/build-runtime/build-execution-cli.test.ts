import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as createMain } from '../../cli/build-run-create.ts';
import { main as listMain } from '../../cli/build-run-list.ts';
import { main as inspectMain } from '../../cli/build-run-inspect.ts';
import { main as executeMain } from '../../cli/build-run-execute.ts';
import { main as materializeMain } from '../../cli/build-run-materialize.ts';

const {
  createBuildExecutionRun,
  executeBuildRun,
} = vi.hoisted(() => ({
  createBuildExecutionRun: vi.fn(() => ({
    runId: 'run-1',
    packetId: 'packet-1',
    bundleId: 'bundle-1',
  })),
  executeBuildRun: vi.fn(() => ({
    runId: 'run-1',
    packetId: 'packet-1',
    bundleId: 'bundle-1',
    status: 'completed',
  })),
}));

const {
  listBuildExecutionRuns,
  inspectBuildExecutionRun,
  materializeBuildExecutionRun,
} = vi.hoisted(() => ({
  listBuildExecutionRuns: vi.fn(() => ([
    { runId: 'run-1', packetId: 'packet-1', bundleId: 'bundle-1', status: 'ready' },
  ])),
  inspectBuildExecutionRun: vi.fn(() => ({
    run: { runId: 'run-1' },
    validation: { validationState: 'valid' },
    projection: { runId: 'run-1', status: 'ready' },
    history: [],
  })),
  materializeBuildExecutionRun: vi.fn(() => ({
    runId: 'run-1',
    dirPath: 'artifacts/build-runtime/run-1',
  })),
}));

vi.mock('../../build-runtime/build-execution-manager.ts', () => ({
  createBuildExecutionManager: vi.fn(() => ({
    createBuildExecutionRun,
    executeBuildRun,
  })),
}));

vi.mock('../../build-runtime/build-execution-inspection.ts', () => ({
  createBuildExecutionInspection: vi.fn(() => ({
    listBuildExecutionRuns,
    inspectBuildExecutionRun,
    materializeBuildExecutionRun,
  })),
}));

describe('build execution CLI', () => {
  it('T-PF6-CLI1 create/list/inspect/execute/materialize output canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain(['--packet', 'packet-1', '--bundle', 'bundle-1'])).toBe(0);
    expect(await listMain([])).toBe(0);
    expect(await inspectMain(['--run', 'run-1'])).toBe(0);
    expect(await executeMain(['--run', 'run-1'])).toBe(0);
    expect(await materializeMain(['--run', 'run-1'])).toBe(0);

    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ runId: 'run-1', packetId: 'packet-1', bundleId: 'bundle-1' })}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify([{ runId: 'run-1', packetId: 'packet-1', bundleId: 'bundle-1', status: 'ready' }])}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(inspectBuildExecutionRun())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(executeBuildRun())}\n`);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(materializeBuildExecutionRun())}\n`);

    stdout.mockRestore();
  });

  it('T-PF6-CLI2 missing argument paths return stable canonical errors', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    expect(await createMain([])).toBe(1);
    expect(await inspectMain([])).toBe(1);
    expect(await executeMain([])).toBe(1);
    expect(await materializeMain([])).toBe(1);
    expect(await listMain(['--bad'])).toBe(1);

    const output = stdout.mock.calls.map((entry) => String(entry[0])).join('');
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --packet' }));
    expect(output).toContain(canonicalStringify({ error: 'MISSING_ARGUMENT: --run' }));
    expect(output).toContain(canonicalStringify({ error: 'UNKNOWN_ARGUMENT: --bad' }));

    stdout.mockRestore();
  });
});
