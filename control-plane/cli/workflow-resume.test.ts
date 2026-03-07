import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './workflow-resume.ts';

const mocks = vi.hoisted(() => ({
  inspectRun: vi.fn(),
  appendEvent: vi.fn(),
  buildWorkflowRunRecord: vi.fn(),
  loadWorkflowDefinitionById: vi.fn(),
  deriveResumeStateFromJournal: vi.fn(),
  resumeWorkflowRun: vi.fn(),
  createSwarmRunner: vi.fn(),
  createSwarmWorkflowExecutor: vi.fn(),
  executeWorkflowRunWithHardening: vi.fn()
}));

vi.mock('../journal/journal.ts', () => ({
  createExecutionJournal: vi.fn(() => ({
    inspectRun: mocks.inspectRun,
    appendEvent: mocks.appendEvent
  }))
}));

vi.mock('../observability/run-record.ts', () => ({ buildWorkflowRunRecord: mocks.buildWorkflowRunRecord }));
vi.mock('../workflows/workflow-loader.ts', () => ({ loadWorkflowDefinitionById: mocks.loadWorkflowDefinitionById }));
vi.mock('../swarm/swarm-runner.ts', () => ({ createSwarmRunner: mocks.createSwarmRunner }));
vi.mock('../workflows/workflow-runner.ts', () => ({ createSwarmWorkflowExecutor: mocks.createSwarmWorkflowExecutor }));
vi.mock('../runtime/hardened-workflow-runtime.ts', () => ({
  deriveResumeStateFromJournal: mocks.deriveResumeStateFromJournal,
  executeWorkflowRunWithHardening: mocks.executeWorkflowRunWithHardening
}));
vi.mock('../runtime/recovery-engine.ts', () => ({
  resumeWorkflowRun: mocks.resumeWorkflowRun
}));

describe('workflow-resume CLI', () => {
  it('appends recovery start/resume events and prints plan', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1', projectId: 'control-plane' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf-1', missionId: 'mission-1' });
    mocks.loadWorkflowDefinitionById.mockReturnValueOnce({ workflowId: 'wf-1', nodes: [] });
    mocks.deriveResumeStateFromJournal.mockReturnValueOnce({
      state: { workflowState: 'failed' },
      initialState: { completedNodeIds: ['node-1'], outputsByNodeId: {}, retriesByNodeId: {}, currentTick: 4 }
    });
    mocks.resumeWorkflowRun.mockReturnValueOnce({
      accepted: true,
      reason: 'RECOVERY_READY',
      plan: {
        resumeNodeIds: ['node-2'],
        skippedCompletedNodeIds: ['node-1']
      }
    });
    mocks.createSwarmRunner.mockReturnValueOnce({ runner: 'swarm' });
    mocks.createSwarmWorkflowExecutor.mockReturnValueOnce({ execute: vi.fn() });
    mocks.executeWorkflowRunWithHardening.mockResolvedValueOnce({
      missionId: 'mission-1',
      workflowId: 'wf-1',
      executionOrder: [],
      nodeResults: []
    });

    const code = await main(['--run=run_1']);

    expect(code).toBe(0);
    expect(mocks.appendEvent).toHaveBeenNthCalledWith(1, expect.objectContaining({ type: 'WORKFLOW_RECOVERY_STARTED' }));
    expect(mocks.appendEvent).toHaveBeenNthCalledWith(2, expect.objectContaining({ type: 'WORKFLOW_RECOVERY_RESUMED' }));
    expect(mocks.executeWorkflowRunWithHardening).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run_1',
      missionId: 'mission-1'
    }));
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

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1', projectId: 'control-plane' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf-1' });
    mocks.loadWorkflowDefinitionById.mockReturnValueOnce({ workflowId: 'wf-1', nodes: [] });
    mocks.deriveResumeStateFromJournal.mockReturnValueOnce({
      state: { workflowState: 'completed' },
      initialState: { completedNodeIds: [], outputsByNodeId: {}, retriesByNodeId: {}, currentTick: 0 }
    });
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
