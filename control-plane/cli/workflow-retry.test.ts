import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './workflow-retry.ts';

const mocks = vi.hoisted(() => ({
  inspectRun: vi.fn(),
  appendEvent: vi.fn(),
  buildWorkflowRunRecord: vi.fn(),
  buildWorkflowNodeRecords: vi.fn(),
  deriveRetryEligibilityFromEvents: vi.fn()
}));

vi.mock('../journal/journal.ts', () => ({
  createExecutionJournal: vi.fn(() => ({
    inspectRun: mocks.inspectRun,
    appendEvent: mocks.appendEvent
  }))
}));

vi.mock('../observability/run-record.ts', () => ({ buildWorkflowRunRecord: mocks.buildWorkflowRunRecord }));
vi.mock('../observability/node-record.ts', () => ({ buildWorkflowNodeRecords: mocks.buildWorkflowNodeRecords }));
vi.mock('../runtime/recovery-engine.ts', () => ({ deriveRetryEligibilityFromEvents: mocks.deriveRetryEligibilityFromEvents }));

describe('workflow-retry CLI', () => {
  it('schedules and starts immediate retry', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf-1' });
    mocks.buildWorkflowNodeRecords.mockReturnValueOnce([{ nodeId: 'node-1', status: 'failed' }]);
    mocks.deriveRetryEligibilityFromEvents.mockReturnValueOnce({
      accepted: true,
      reason: 'RETRY_ELIGIBLE',
      retryAttempt: 1,
      tickDelay: 0
    });

    const code = await main(['--run=run_1', '--node=node-1']);

    expect(code).toBe(0);
    expect(mocks.appendEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'NODE_RETRY_SCHEDULED' }));
    expect(mocks.appendEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'NODE_RETRY_STARTED' }));
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      runId: 'run_1',
      workflowId: 'wf-1',
      nodeId: 'node-1',
      retryAttempt: 1,
      tickDelay: 0,
      scheduled: true,
      started: true
    })}\n`);
    stdout.mockRestore();
  });

  it('returns stable error for ineligible node', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf-1' });
    mocks.buildWorkflowNodeRecords.mockReturnValueOnce([{ nodeId: 'node-1', status: 'completed' }]);

    const code = await main(['--run=run_1', '--node=node-1']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'NODE_NOT_RETRYABLE_STATE' })}\n`);
    stdout.mockRestore();
  });
});
