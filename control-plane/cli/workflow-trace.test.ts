import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './workflow-trace.ts';

const mocks = vi.hoisted(() => ({
  inspectRun: vi.fn(),
  buildWorkflowRunRecord: vi.fn(),
  buildWorkflowNodeRecords: vi.fn(),
  buildWorkflowTrace: vi.fn()
}));

vi.mock('../journal/journal.ts', () => ({
  createExecutionJournal: vi.fn(() => ({ inspectRun: mocks.inspectRun }))
}));

vi.mock('../observability/run-record.ts', () => ({ buildWorkflowRunRecord: mocks.buildWorkflowRunRecord }));
vi.mock('../observability/node-record.ts', () => ({ buildWorkflowNodeRecords: mocks.buildWorkflowNodeRecords }));
vi.mock('../observability/trace-builder.ts', () => ({ buildWorkflowTrace: mocks.buildWorkflowTrace }));

describe('workflow-trace CLI', () => {
  it('prints trace entries', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf' });
    mocks.buildWorkflowNodeRecords.mockReturnValueOnce([]);
    mocks.buildWorkflowTrace.mockReturnValueOnce([{ sequence: 1, type: 'RUN_STARTED' }]);

    const code = await main(['--run=run_1']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify([{ sequence: 1, type: 'RUN_STARTED' }])}\n`);
    stdout.mockRestore();
  });

  it('returns error for missing --run', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main([]);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --run' })}\n`);
    stdout.mockRestore();
  });
});
