import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './workflow-node-inspect.ts';

const mocks = vi.hoisted(() => ({
  inspectRun: vi.fn(),
  buildWorkflowRunRecord: vi.fn(),
  buildWorkflowNodeRecords: vi.fn(),
  getNodeDiagnosticReport: vi.fn()
}));

vi.mock('../journal/journal.ts', () => ({
  createExecutionJournal: vi.fn(() => ({ inspectRun: mocks.inspectRun }))
}));

vi.mock('../observability/run-record.ts', () => ({ buildWorkflowRunRecord: mocks.buildWorkflowRunRecord }));
vi.mock('../observability/node-record.ts', () => ({ buildWorkflowNodeRecords: mocks.buildWorkflowNodeRecords }));
vi.mock('../observability/diagnostics.ts', () => ({ getNodeDiagnosticReport: mocks.getNodeDiagnosticReport }));

describe('workflow-node-inspect CLI', () => {
  it('prints node diagnostics payload', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf' });
    mocks.buildWorkflowNodeRecords.mockReturnValueOnce([{ nodeId: 'node-a' }]);
    mocks.getNodeDiagnosticReport.mockReturnValueOnce({ nodeId: 'node-a', status: 'completed' });

    const code = await main(['--run=run_1', '--node=node-a']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ nodeId: 'node-a', status: 'completed' })}\n`);
    stdout.mockRestore();
  });

  it('returns error for missing --node', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const code = await main(['--run=run_1']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'MISSING_ARGUMENT: --node' })}\n`);
    stdout.mockRestore();
  });
});
