import { describe, expect, it, vi } from 'vitest';

import { canonicalStringify } from '../finance/determinism.ts';
import { main } from './workflow-run-inspect.ts';

const mocks = vi.hoisted(() => ({
  inspectRun: vi.fn(),
  buildWorkflowRunRecord: vi.fn(),
  buildWorkflowNodeRecords: vi.fn(),
  getRunDiagnosticReport: vi.fn(),
  listArtifactsForRun: vi.fn(),
  parseArtifactExpectationsFromEvents: vi.fn(),
  buildNormalizedRunInspection: vi.fn()
}));

vi.mock('../journal/journal.ts', () => ({
  createExecutionJournal: vi.fn(() => ({ inspectRun: mocks.inspectRun }))
}));

vi.mock('../observability/run-record.ts', () => ({ buildWorkflowRunRecord: mocks.buildWorkflowRunRecord }));
vi.mock('../observability/node-record.ts', () => ({ buildWorkflowNodeRecords: mocks.buildWorkflowNodeRecords }));
vi.mock('../observability/diagnostics.ts', () => ({ getRunDiagnosticReport: mocks.getRunDiagnosticReport }));
vi.mock('../../runtime/output/artifact-listing.ts', () => ({ listArtifactsForRun: mocks.listArtifactsForRun }));
vi.mock('../operator/run-inspection.ts', () => ({
  parseArtifactExpectationsFromEvents: mocks.parseArtifactExpectationsFromEvents,
  buildNormalizedRunInspection: mocks.buildNormalizedRunInspection
}));

describe('workflow-run-inspect CLI', () => {
  it('prints run inspection payload', async () => {
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    mocks.inspectRun.mockReturnValueOnce({ run: { runId: 'run_1' }, events: [] });
    mocks.buildWorkflowRunRecord.mockReturnValueOnce({
      runId: 'run_1',
      workflowId: 'wf',
      missionId: 'm1',
      teamId: 't1',
      projectId: 'p1',
      status: 'completed',
      activeNodeId: null,
      summary: { summaryLine: 'line' }
    });
    mocks.buildWorkflowNodeRecords.mockReturnValueOnce([
      {
        nodeId: 'node-a',
        status: 'completed',
        sequenceStarted: 2,
        sequenceCompleted: 3,
        agentId: 'a1',
        adapterId: 'llm'
      }
    ]);
    mocks.getRunDiagnosticReport.mockReturnValueOnce({
      failedNodeIds: [],
      finalContextKeys: ['k1'],
      firstInspectTarget: { targetType: 'node', nodeId: 'node-a' }
    });
    mocks.parseArtifactExpectationsFromEvents.mockReturnValueOnce([]);
    mocks.listArtifactsForRun.mockReturnValueOnce([]);
    mocks.buildNormalizedRunInspection.mockReturnValueOnce({
      runId: 'run_1',
      missionId: 'm1',
      workflowId: 'wf',
      teamId: 't1',
      status: 'succeeded',
      attemptCount: 1,
      currentAttemptIndex: 0,
      retryCount: 0,
      artifacts: [],
      attempts: [{ attemptIndex: 0, status: 'succeeded' }],
      artifactValidation: {
        status: 'complete',
        missingRequired: [],
        missingOptional: []
      }
    });

    const code = await main(['--run=run_1']);

    expect(code).toBe(0);
    expect(stdout).toHaveBeenCalledWith(`${canonicalStringify({
      summary: { summaryLine: 'line' },
      workflow: {
        workflowId: 'wf',
        runId: 'run_1',
        missionId: 'm1',
        teamId: 't1',
        projectId: 'p1',
        status: 'completed'
      },
      runtime: {
        runId: 'run_1',
        missionId: 'm1',
        workflowId: 'wf',
        teamId: 't1',
        status: 'succeeded',
        attemptCount: 1,
        currentAttemptIndex: 0,
        retryCount: 0,
        artifacts: [],
        attempts: [{ attemptIndex: 0, status: 'succeeded' }],
        artifactValidation: {
          status: 'complete',
          missingRequired: [],
          missingOptional: []
        }
      },
      nodes: [
        {
          nodeId: 'node-a',
          status: 'completed',
          sequenceStarted: 2,
          sequenceCompleted: 3,
          agentId: 'a1',
          adapterId: 'llm'
        }
      ],
      activeNodeId: null,
      failedNodeIds: [],
      finalContextKeys: ['k1'],
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
