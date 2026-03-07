import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './workflow-failures.ts';

const mocks = vi.hoisted(() => ({
  inspectRun: vi.fn(),
  buildWorkflowRunRecord: vi.fn(),
  buildWorkflowNodeRecords: vi.fn(),
  extractWorkflowFailures: vi.fn(),
  firstInspectTarget: vi.fn()
}));

vi.mock('../journal/journal.ts', () => ({
  createExecutionJournal: vi.fn(() => ({ inspectRun: mocks.inspectRun }))
}));

vi.mock('../observability/run-record.ts', () => ({ buildWorkflowRunRecord: mocks.buildWorkflowRunRecord }));
vi.mock('../observability/node-record.ts', () => ({ buildWorkflowNodeRecords: mocks.buildWorkflowNodeRecords }));
vi.mock('../observability/diagnostics.ts', () => ({
  extractWorkflowFailures: mocks.extractWorkflowFailures,
  firstInspectTarget: mocks.firstInspectTarget
}));

describe('workflow-failures CLI', () => {
  it('prints failure diagnostics', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf', status: 'failed', activeNodeId: null });
    mocks.buildWorkflowNodeRecords.mockReturnValueOnce([{ nodeId: 'node-a' }]);
    mocks.extractWorkflowFailures.mockReturnValueOnce([{ code: 'ADAPTER_EXECUTION_FAILED', nodeId: 'node-a' }]);
    mocks.firstInspectTarget.mockReturnValueOnce({ targetType: 'node', nodeId: 'node-a' });

    const code = await main(['--run=run_1']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      runId: 'run_1',
      workflowId: 'wf',
      failureCount: 1,
      failures: [{ code: 'ADAPTER_EXECUTION_FAILED', nodeId: 'node-a' }],
      firstInspectTarget: { targetType: 'node', nodeId: 'node-a' }
    })}\n`);
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
