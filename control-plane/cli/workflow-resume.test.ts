import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './workflow-resume.ts';

const mocks = vi.hoisted(() => ({
  inspectRun: vi.fn(),
  appendEvent: vi.fn(),
  buildWorkflowRunRecord: vi.fn(),
  loadWorkflowDefinitionById: vi.fn(),
  reconstructWorkflowStateFromJournal: vi.fn(),
  resumeWorkflowRun: vi.fn()
}));

vi.mock('../journal/journal.ts', () => ({
  createExecutionJournal: vi.fn(() => ({
    inspectRun: mocks.inspectRun,
    appendEvent: mocks.appendEvent
  }))
}));

vi.mock('../observability/run-record.ts', () => ({ buildWorkflowRunRecord: mocks.buildWorkflowRunRecord }));
vi.mock('../workflows/workflow-loader.ts', () => ({ loadWorkflowDefinitionById: mocks.loadWorkflowDefinitionById }));
vi.mock('../runtime/recovery-engine.ts', () => ({
  reconstructWorkflowStateFromJournal: mocks.reconstructWorkflowStateFromJournal,
  resumeWorkflowRun: mocks.resumeWorkflowRun
}));

describe('workflow-resume CLI', () => {
  it('appends recovery start/resume events and prints plan', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf-1' });
    mocks.loadWorkflowDefinitionById.mockReturnValueOnce({ workflowId: 'wf-1', nodes: [] });
    mocks.reconstructWorkflowStateFromJournal.mockReturnValueOnce({ workflowState: 'failed' });
    mocks.resumeWorkflowRun.mockReturnValueOnce({
      accepted: true,
      reason: 'RECOVERY_READY',
      plan: {
        resumeNodeIds: ['node-2'],
        skippedCompletedNodeIds: ['node-1']
      }
    });

    const code = await main(['--run=run_1']);

    expect(code).toBe(0);
    expect(mocks.appendEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'WORKFLOW_RECOVERY_STARTED' }));
    expect(mocks.appendEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'WORKFLOW_RECOVERY_RESUMED' }));
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      runId: 'run_1',
      workflowId: 'wf-1',
      resumedNodeIds: ['node-2'],
      skippedCompletedNodeIds: ['node-1']
    })}\n`);
    stdout.mockRestore();
  });

  it('returns stable error when run is not resumable', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf-1' });
    mocks.loadWorkflowDefinitionById.mockReturnValueOnce({ workflowId: 'wf-1', nodes: [] });
    mocks.reconstructWorkflowStateFromJournal.mockReturnValueOnce({ workflowState: 'completed' });
    mocks.resumeWorkflowRun.mockReturnValueOnce({
      accepted: false,
      reason: 'ALREADY_COMPLETED',
      plan: { resumeNodeIds: [], skippedCompletedNodeIds: [] }
    });

    const code = await main(['--run=run_1']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'WORKFLOW_NOT_RESUMABLE: ALREADY_COMPLETED' })}\n`);
    stdout.mockRestore();
  });
});
