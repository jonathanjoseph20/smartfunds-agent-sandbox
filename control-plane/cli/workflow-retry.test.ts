import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './workflow-retry.ts';

const mocks = vi.hoisted(() => ({
  inspectRun: vi.fn(),
  appendEvent: vi.fn(),
  buildWorkflowRunRecord: vi.fn(),
  buildWorkflowNodeRecords: vi.fn(),
  deriveRetryEligibilityFromEvents: vi.fn(),
  loadWorkflowDefinitionById: vi.fn(),
  deriveResumeStateFromJournal: vi.fn(),
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
vi.mock('../observability/node-record.ts', () => ({ buildWorkflowNodeRecords: mocks.buildWorkflowNodeRecords }));
vi.mock('../workflows/workflow-loader.ts', () => ({ loadWorkflowDefinitionById: mocks.loadWorkflowDefinitionById }));
vi.mock('../swarm/swarm-runner.ts', () => ({ createSwarmRunner: mocks.createSwarmRunner }));
vi.mock('../workflows/workflow-runner.ts', () => ({ createSwarmWorkflowExecutor: mocks.createSwarmWorkflowExecutor }));
vi.mock('../runtime/hardened-workflow-runtime.ts', () => ({
  deriveResumeStateFromJournal: mocks.deriveResumeStateFromJournal,
  executeWorkflowRunWithHardening: mocks.executeWorkflowRunWithHardening
}));
vi.mock('../runtime/recovery-engine.ts', () => ({ deriveRetryEligibilityFromEvents: mocks.deriveRetryEligibilityFromEvents }));

describe('workflow-retry CLI', () => {
  it('schedules and starts immediate retry', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1', projectId: 'control-plane' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf-1', missionId: 'mission-1' });
    mocks.buildWorkflowNodeRecords.mockReturnValueOnce([{ nodeId: 'node-1', status: 'failed' }]);
    mocks.loadWorkflowDefinitionById.mockReturnValueOnce({ workflowId: 'wf-1', nodes: [] });
    mocks.deriveRetryEligibilityFromEvents.mockReturnValueOnce({
      accepted: true,
      reason: 'RETRY_ELIGIBLE',
      retryAttempt: 1,
      tickDelay: 0
    });
    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1', projectId: 'control-plane' }, events: [] });
    mocks.deriveResumeStateFromJournal.mockReturnValueOnce({
      state: { workflowState: 'failed' },
      initialState: { completedNodeIds: [], outputsByNodeId: {}, retriesByNodeId: {}, currentTick: 2 }
    });
    mocks.createSwarmRunner.mockReturnValueOnce({ runner: 'swarm' });
    mocks.createSwarmWorkflowExecutor.mockReturnValueOnce({ execute: vi.fn() });
    mocks.executeWorkflowRunWithHardening.mockResolvedValueOnce({
      missionId: 'mission-1',
      workflowId: 'wf-1',
      executionOrder: ['node-1'],
      nodeResults: []
    });

    const code = await main(['--run=run_1', '--node=node-1']);

    expect(code).toBe(0);
    expect(mocks.appendEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'NODE_RETRY_SCHEDULED' }));
    expect(mocks.executeWorkflowRunWithHardening).toHaveBeenCalledWith(expect.objectContaining({
      runId: 'run_1',
      missionId: 'mission-1'
    }));
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

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1', projectId: 'control-plane' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({ runId: 'run_1', workflowId: 'wf-1' });
    mocks.buildWorkflowNodeRecords.mockReturnValueOnce([{ nodeId: 'node-1', status: 'completed' }]);

    const code = await main(['--run=run_1', '--node=node-1']);

    expect(code).toBe(1);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({ error: 'NODE_NOT_RETRYABLE_STATE' })}\n`);
    stdout.mockRestore();
  });
});
