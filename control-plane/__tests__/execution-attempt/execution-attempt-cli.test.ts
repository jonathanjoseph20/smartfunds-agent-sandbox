import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../../finance/determinism.ts';
import { main as cancelMain } from '../../cli/execution-attempt-cancel.ts';
import { main as createMain } from '../../cli/execution-attempt-create.ts';
import { main as evaluateMain } from '../../cli/execution-attempt-evaluate.ts';
import { main as historyMain } from '../../cli/execution-attempt-history.ts';
import { main as inspectMain } from '../../cli/execution-attempt-inspect.ts';
import { main as listMain } from '../../cli/execution-attempt-list.ts';
import { main as materializeMain } from '../../cli/execution-attempt-materialize.ts';
import { main as statusMain } from '../../cli/execution-attempt-status.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-execution-attempt-cli');

const {
  listExecutionAttempts,
  inspectExecutionAttempt,
  executionAttemptStatus,
  executionAttemptHistory,
  materializeExecutionAttempt,
  evaluateExecutionAttempt,
  createExecutionAttempt,
  cancelExecutionAttempt,
} = vi.hoisted(() => ({
  listExecutionAttempts: vi.fn(() => [{ executionAttemptId: 'ea-1', runtimeEnvelopeId: 're-1' }]),
  inspectExecutionAttempt: vi.fn(() => ({ executionAttemptId: 'ea-1', runtimeEnvelopeId: 're-1' })),
  executionAttemptStatus: vi.fn(() => ({ executionAttemptId: 'ea-1', attemptState: 'pending' })),
  executionAttemptHistory: vi.fn(() => ({ executionAttemptId: 'ea-1', entries: [] })),
  materializeExecutionAttempt: vi.fn(() => ({ executionAttemptId: 'ea-1' })),
  evaluateExecutionAttempt: vi.fn(() => ({ executionAttemptId: 'ea-1' })),
  createExecutionAttempt: vi.fn(() => ({ executionAttemptId: 'ea-1', attemptLifecycleState: 'prepared' })),
  cancelExecutionAttempt: vi.fn(() => ({ executionAttemptId: 'ea-1', attemptLifecycleState: 'cancelled' })),
}));

vi.mock('../../execution-attempt/execution-attempt-inspection.ts', () => ({
  createExecutionAttemptInspection: vi.fn(() => ({
    listExecutionAttempts,
    inspectExecutionAttempt,
    executionAttemptStatus,
    executionAttemptHistory,
    materializeExecutionAttempt,
    evaluateExecutionAttempt,
    createExecutionAttempt,
    cancelExecutionAttempt,
  })),
}));

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('execution attempt CLI commands', () => {
  it('T-MEA-CLI1 list prints canonical JSON', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await listMain([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify(listExecutionAttempts())}\n`);
    stdout.mockRestore();
  });

  it('T-MEA-CLI2 inspect requires --attempt', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await inspectMain([]);

    expect(code).toBe(1);
    expect(stdout.mock.calls.map((call) => String(call[0])).join('')).toContain('MISSING_ARGUMENT: --attempt');
    stdout.mockRestore();
  });

  it('T-MEA-CLI3 status routes attempt argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await statusMain(['--attempt', 'ea-1']);

    expect(code).toBe(0);
    expect(executionAttemptStatus).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    stdout.mockRestore();
  });

  it('T-MEA-CLI4 history routes attempt argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await historyMain(['--attempt=ea-1']);

    expect(code).toBe(0);
    expect(executionAttemptHistory).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    stdout.mockRestore();
  });

  it('T-MEA-CLI5 evaluate and materialize route attempt argument', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const evaluateCode = await evaluateMain(['--attempt', 'ea-1']);
    const materializeCode = await materializeMain(['--attempt', 'ea-1']);

    expect(evaluateCode).toBe(0);
    expect(materializeCode).toBe(0);
    expect(evaluateExecutionAttempt).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    expect(materializeExecutionAttempt).toHaveBeenCalledWith({ executionAttemptId: 'ea-1' });
    stdout.mockRestore();
  });

  it('T-MEA-CLI6 create routes envelope and attempt index arguments', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await createMain(['--envelope', 're-1', '--attempt-index', '2']);

    expect(code).toBe(0);
    expect(createExecutionAttempt).toHaveBeenCalledWith({ runtimeEnvelopeId: 're-1', attemptIndex: 2 });
    stdout.mockRestore();
  });

  it('T-MEA-CLI7 cancel reads reason file and routes payload', async () => {
    fs.mkdirSync(tmpRoot, { recursive: true });
    const reasonFile = path.join(tmpRoot, 'reason.txt');
    fs.writeFileSync(reasonFile, 'manual cancellation rationale\n', 'utf8');

    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await cancelMain([
      '--attempt',
      'ea-1',
      '--reason-file',
      reasonFile,
      '--cancelled-by',
      'founder',
    ]);

    expect(code).toBe(0);
    expect(cancelExecutionAttempt).toHaveBeenCalledWith({
      executionAttemptId: 'ea-1',
      reason: 'manual cancellation rationale',
      cancelledBy: 'founder',
    });
    stdout.mockRestore();
  });

  it('T-MEA-CLI8 stable error payload shape is preserved', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    inspectExecutionAttempt.mockImplementationOnce(() => {
      throw new Error('EXECUTION_ATTEMPT_NOT_FOUND');
    });

    const code = await inspectMain(['--attempt', 'missing']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenLastCalledWith(`${canonicalStringify({ error: 'EXECUTION_ATTEMPT_NOT_FOUND' })}\n`);
    stdout.mockRestore();
  });
});
