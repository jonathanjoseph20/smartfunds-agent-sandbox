import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './workflow-runs.ts';

const mocks = vi.hoisted(() => ({
  listRuns: vi.fn(),
  inspectRun: vi.fn(),
  buildWorkflowRunRecords: vi.fn()
}));

vi.mock('../journal/journal.ts', () => ({
  createExecutionJournal: vi.fn(() => ({
    listRuns: mocks.listRuns,
    inspectRun: mocks.inspectRun
  }))
}));

vi.mock('../observability/run-record.ts', () => ({
  buildWorkflowRunRecords: mocks.buildWorkflowRunRecords
}));

describe('workflow-runs CLI', () => {
  it('prints deterministic run list', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.listRuns.mockReturnValueOnce([{ runId: 'run_1' }]);
    mocks.inspectRun.mockImplementation((runId: string) => ({ run: { runId }, events: [] }));
    mocks.buildWorkflowRunRecords.mockReturnValueOnce([
      {
        runId: 'run_1',
        workflowId: 'wf',
        missionId: 'm1',
        status: 'completed',
        completedNodeCount: 2,
        failedNodeCount: 0
      }
    ]);

    const code = await main([]);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify([
      {
        runId: 'run_1',
        workflowId: 'wf',
        missionId: 'm1',
        status: 'completed',
        completedNodeCount: 2,
        failedNodeCount: 0
      }
    ])}\n`);
    stdout.mockRestore();
  });

  it('returns non-zero on invalid limit', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main(['--limit=0']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'INVALID_ARGUMENT: --limit' })}\n`);
    stdout.mockRestore();
  });
});
