import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as listMain } from '../../cli/execution-engine-list.ts';
import { main as inspectMain } from '../../cli/execution-engine-inspect.ts';
import { main as statusMain } from '../../cli/execution-engine-status.ts';
import { main as historyMain } from '../../cli/execution-engine-history.ts';
import { main as materializeMain } from '../../cli/execution-engine-materialize.ts';
import { main as evaluateMain } from '../../cli/execution-engine-evaluate.ts';
import { main as startMain } from '../../cli/execution-engine-start.ts';
import { main as completeMain } from '../../cli/execution-engine-complete.ts';
import { main as failMain } from '../../cli/execution-engine-fail.ts';
import { main as cancelMain } from '../../cli/execution-engine-cancel.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-engine-cli');

const {
  listEngineRuns,
  inspectEngineRun,
  engineRunStatus,
  engineRunHistory,
  materializeEngineRun,
  evaluateEngineReadiness,
  startEngineRun,
  completeEngineRun,
  failEngineRun,
  cancelEngineRun,
} = vi.hoisted(() => ({
  listEngineRuns: vi.fn(() => [{ executionEngineRunId: 'er-1', executionAttemptId: 'ea-1' }]),
  inspectEngineRun: vi.fn(() => ({ executionEngineRunId: 'er-1' })),
  engineRunStatus: vi.fn(() => ({ executionEngineRunId: 'er-1', engineState: 'eligible_to_start' })),
  engineRunHistory: vi.fn(() => ({ executionEngineRunId: 'er-1', entries: [] })),
  materializeEngineRun: vi.fn(() => ({ executionEngineRunId: 'er-1' })),
  evaluateEngineReadiness: vi.fn(() => ({ executionEngineRunId: 'er-1' })),
  startEngineRun: vi.fn(() => ({ executionEngineRunId: 'er-1', engineState: 'running' })),
  completeEngineRun: vi.fn(() => ({ executionEngineRunId: 'er-1', engineState: 'completed' })),
  failEngineRun: vi.fn(() => ({ executionEngineRunId: 'er-1', engineState: 'failed' })),
  cancelEngineRun: vi.fn(() => ({ executionEngineRunId: 'er-1', engineState: 'cancelled' })),
}));

vi.mock('../../execution-engine/execution-engine-inspection.ts', () => ({
  createExecutionEngineInspection: vi.fn(() => ({
    listEngineRuns,
    inspectEngineRun,
    engineRunStatus,
    engineRunHistory,
    materializeEngineRun,
    evaluateEngineReadiness,
    startEngineRun,
    completeEngineRun,
    failEngineRun,
    cancelEngineRun,
  })),
}));

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution engine CLI commands', () => {
  it('T-MEE-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listEngineRuns())}\n`);
    stdout.mockRestore();
  });

  it('T-MEE-CLI2 inspect requires --attempt', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --attempt');
    stdout.mockRestore();
  });

  it('T-MEE-CLI3 status, history, evaluate, materialize route attempt argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await statusMain(['--attempt', 'ea-1']);
    await historyMain(['--attempt=ea-1']);
    await evaluateMain(['--attempt', 'ea-1']);
    await materializeMain(['--attempt', 'ea-1']);

    expect(engineRunStatus).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    expect(engineRunHistory).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    expect(evaluateEngineReadiness).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    expect(materializeEngineRun).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    stdout.mockRestore();
  });

  it('T-MEE-CLI4 start and complete route attempt argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await startMain(['--attempt', 'ea-1']);
    await completeMain(['--attempt=ea-1']);

    expect(startEngineRun).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    expect(completeEngineRun).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    stdout.mockRestore();
  });

  it('T-MEE-CLI5 fail and cancel require reason-file and route payload', async () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    const reasonFile = path.join(tmpRoot, 'reason.txt');
    fs.writeFileSync(reasonFile, 'engine reason\n', 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await failMain(['--attempt', 'ea-1', '--reason-file', reasonFile]);
    await cancelMain(['--attempt', 'ea-1', '--reason-file', reasonFile]);

    expect(failEngineRun).toHaveBeenCalledWith({ executionAttemptId: 'ea-1', failureReason: 'engine reason' });
    expect(cancelEngineRun).toHaveBeenCalledWith({ executionAttemptId: 'ea-1', cancellationReason: 'engine reason' });
    stdout.mockRestore();
  });

  it('T-MEE-CLI6 stable error payload shape is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectEngineRun.mockImplementationOnce(() => {
      throw new Error('EXECUTION_ENGINE_RUN_NOT_FOUND');
    });

    const code = await inspectMain(['--attempt', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'EXECUTION_ENGINE_RUN_NOT_FOUND' })}\n`);
    stdout.mockRestore();
  });
});
