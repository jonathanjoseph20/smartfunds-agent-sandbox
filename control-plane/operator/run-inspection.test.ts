import { describe, expect, it } from 'vitest';

import {
  buildNormalizedRunInspection,
  parseArtifactExpectationsFromEvents,
  summarizeArtifacts,
  type ArtifactExpectation
} from './run-inspection.ts';

const baseRun = {
  runId: 'run_1',
  workflowId: 'wf_1',
  missionId: 'mission-1',
  teamId: 'team-1',
  profile: null,
  executionPath: null,
  projectId: 'smartfunds-core',
  status: 'completed',
  nodeCount: 1,
  completedNodeCount: 1,
  failedNodeCount: 0,
  timeoutNodeCount: 0,
  retryCount: 0,
  startSequence: 1,
  endSequence: 3,
  activeNodeId: null,
  agentRoster: [],
  summary: {
    runId: 'run_1',
    workflowId: 'wf_1',
    missionId: 'mission-1',
    teamId: 'team-1',
    projectId: 'smartfunds-core',
    status: 'completed',
    nodeCount: 1,
    completedNodeCount: 1,
    failedNodeCount: 0,
    timeoutNodeCount: 0,
    activeNodeId: null,
    lastAgentUsed: null,
    totalOutputsGenerated: 0,
    totalRetriesConsumed: 0,
    replayable: true,
    hasFailure: false,
    recoverable: false,
    resumed: false,
    cancelled: false,
    safetyViolationCount: 0,
    summaryLine: 'summary'
  }
} as const;

const completedNode = {
  runId: 'run_1',
  workflowId: 'wf_1',
  nodeId: 'node-1',
  agentId: null,
  adapterId: 'repo',
  status: 'completed',
  dependsOn: [],
  sequenceStarted: 1,
  sequenceCompleted: 2,
  taskInputs: {},
  taskOutputs: {},
  previousOutputs: {},
  contextSnapshot: {},
  failure: null,
  retryCount: 0,
  timeoutType: null
} as const;

describe('run inspection normalization', () => {
  it('T-RH1 returns succeeded lifecycle with deterministic artifact summaries', () => {
    const artifacts: ArtifactExpectation[] = [
      { path: 'dataset.csv', type: 'csv', required: false },
      { path: 'report.md', type: 'markdown', required: true }
    ];

    const inspection = buildNormalizedRunInspection({
      run: { ...baseRun },
      events: [],
      nodeStates: [{ ...completedNode }],
      expectedArtifacts: artifacts,
      actualArtifactFiles: ['report.md']
    });

    expect(inspection.status).toBe('succeeded');
    expect(inspection.attemptCount).toBe(1);
    expect(inspection.retryCount).toBe(0);
    expect(inspection.artifactValidation).toEqual({
      status: 'partial',
      missingRequired: [],
      missingOptional: ['dataset.csv']
    });
    expect(inspection.artifacts.map((artifact) => artifact.path)).toEqual(['dataset.csv', 'report.md']);
  });

  it('T-RH2 reports retry attempt history deterministically', () => {
    const inspection = buildNormalizedRunInspection({
      run: { ...baseRun, status: 'completed', retryCount: 1 },
      events: [
        {
          runId: 'run_1',
          eventId: 'evt_1',
          sequence: 1,
          type: 'NODE_RETRY_SCHEDULED',
          phase: 'implement',
          taskId: 'node-1',
          artifactId: null,
          payload: { retryAttempt: 1 }
        }
      ],
      nodeStates: [{ ...completedNode, retryCount: 1 }],
      expectedArtifacts: [],
      actualArtifactFiles: []
    });

    expect(inspection.retryCount).toBe(1);
    expect(inspection.attemptCount).toBe(2);
    expect(inspection.currentAttemptIndex).toBe(1);
    expect(inspection.attempts).toEqual([
      {
        attemptIndex: 0,
        status: 'failed'
      },
      {
        attemptIndex: 1,
        status: 'succeeded'
      }
    ]);
  });

  it('T-RH3 maps workflow definition failure class deterministically', () => {
    const inspection = buildNormalizedRunInspection({
      run: { ...baseRun, status: 'failed' },
      events: [],
      nodeStates: [{
        ...completedNode,
        status: 'failed',
        sequenceCompleted: 2,
        failure: {
          code: 'WORKFLOW_VALIDATION_FAILED',
          message: 'workflow.schema_invalid',
          nodeId: 'node-1',
          agentId: null,
          adapterId: null,
          details: {}
        }
      }],
      expectedArtifacts: [],
      actualArtifactFiles: []
    });

    expect(inspection.status).toBe('failed');
    expect(inspection.failureClass).toBe('workflow_definition_error');
    expect(inspection.failureReason).toBe('workflow.schema_invalid');
  });

  it('T-RH4 fails succeeded run when required artifact is missing', () => {
    const inspection = buildNormalizedRunInspection({
      run: { ...baseRun, status: 'completed' },
      events: [],
      nodeStates: [{ ...completedNode }],
      expectedArtifacts: [{ path: 'report.md', type: 'markdown', required: true }],
      actualArtifactFiles: []
    });

    expect(inspection.status).toBe('failed');
    expect(inspection.failureClass).toBe('artifact_validation_error');
    expect(inspection.failureReason).toContain('required artifact missing: report.md');
  });

  it('T-RH5 parses declared artifacts from runtime context snapshots', () => {
    const parsed = parseArtifactExpectationsFromEvents([
      {
        runId: 'run_1',
        eventId: 'evt_1',
        sequence: 1,
        type: 'TASK_STARTED',
        phase: 'implement',
        taskId: 'node-1',
        artifactId: null,
        payload: {
          context_snapshot: {
            memory: {
              declaredArtifacts: [
                { artifactId: 'report', format: 'markdown' },
                { artifactId: 'dataset', format: 'csv', required: false }
              ]
            }
          }
        }
      }
    ]);

    expect(parsed).toEqual([
      { path: 'dataset.csv', type: 'csv', required: false },
      { path: 'report.md', type: 'markdown', required: true }
    ]);
  });

  it('T-RH6 summarizes required and optional missing artifacts stably', () => {
    const result = summarizeArtifacts({
      expected: [
        { path: 'b.md', required: true },
        { path: 'a.csv', required: false }
      ],
      actualFiles: ['c.json']
    });

    expect(result.status).toBe('failed');
    expect(result.missingRequired).toEqual(['b.md']);
    expect(result.missingOptional).toEqual(['a.csv']);
    expect(result.artifacts.map((entry) => entry.path)).toEqual(['a.csv', 'b.md', 'c.json']);
  });
});
