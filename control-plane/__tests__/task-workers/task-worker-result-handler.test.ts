import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskExecutionHistoryStore, resolveTaskExecutionArtifactPaths } from '../../task-execution/task-execution-history-store.ts';
import { createTaskExecutionProjection } from '../../task-execution/task-execution-projection.ts';
import { createTaskWorkClaimService } from '../../task-execution/task-work-claim.ts';
import { createTaskWorkerResultHandler } from '../../task-execution/task-worker-result-handler.ts';
import type { MissionTaskGraphProjection } from '../../task-graph/task-graph-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-workers-result');

function makeTaskGraph(): MissionTaskGraphProjection {
  return {
    taskGraphId: 'tg-1',
    executionEngineRunId: 'er-1',
    executionAttemptId: 'ea-1',
    runtimeEnvelopeId: 're-1',
    executionContractId: 'ec-1',
    missionId: 'm-1',
    taskNodes: [{
      taskNodeId: 'node-a',
      taskGraphId: 'tg-1',
      taskType: 'shell',
      taskName: 'A',
      taskDescription: 'A',
      taskInputs: {},
      taskOutputs: {},
      requiredCapabilities: ['filesystem'],
      retryPolicy: {
        retryPolicyId: 'mission_task_retry_default_v1',
        maxRetries: 2,
        retryStrategy: 'immediate',
        retryDelayModel: 'deterministic_linear',
        retryConditions: ['RETRYABLE_FAILURE', 'SYSTEM_FAILURE'],
        baseDelay: 1,
      },
      taskState: 'ready',
      taskEligibilityState: 'eligible',
      blockingReasons: [],
      limitations: [],
      provenanceInputs: {},
    }],
    taskEdges: [],
    graphState: 'ready_for_execution',
    graphEligibilityState: 'eligible',
    nodeCount: 1,
    edgeCount: 0,
    blockingReasons: [],
    limitations: [],
    provenanceInputs: {
      engineState: 'running',
      engineEligibilityState: 'eligible',
      engineBlockingReasons: [],
      engineLimitations: [],
      runtimeEnvelopeState: 'ready_for_runtime',
      runtimeEnvelopeEligibility: 'eligible',
      runtimeEnvelopeLimitations: [],
      runtimeEnvelopeBlockers: [],
    },
    historySummary: { totalEvents: 0 },
    nodeStateCounts: { pending: 0, ready: 1, running: 0, completed: 0, failed: 0, blocked: 0, skipped: 0 },
    readyNodeCount: 1,
    runningNodeCount: 0,
    completedNodeCount: 0,
    blockedNodeCount: 0,
    statusPreview: {},
    reportPreview: {},
    artifactPaths: {
      dirPath: '', statusJsonPath: '', reportJsonPath: '', reportMarkdownPath: '', historyJsonPath: '', nodesJsonPath: '', edgesJsonPath: '',
    },
  };
}

function createHarness(root: string) {
  const taskGraph = makeTaskGraph();
  const taskGraphProjection = {
    projectOne: () => taskGraph,
    projectAll: () => [taskGraph],
    summarizeList: () => [{ taskGraphId: taskGraph.taskGraphId }],
  };

  const historyStore = createTaskExecutionHistoryStore({ artifactsRoot: path.join(root, 'artifacts') });
  const projection = createTaskExecutionProjection({
    taskGraphProjection: taskGraphProjection as never,
    historyStore,
    taskExecutionArtifactsRoot: path.join(root, 'artifacts'),
  });

  const claimService = createTaskWorkClaimService({
    projection,
    historyStore,
    taskGraphProjection: taskGraphProjection as never,
    taskExecutionArtifactsRoot: path.join(root, 'artifacts'),
  });

  const resultHandler = createTaskWorkerResultHandler({
    projection,
    historyStore,
    taskGraphProjection: taskGraphProjection as never,
    taskExecutionArtifactsRoot: path.join(root, 'artifacts'),
  });

  return { taskGraph, projection, claimService, resultHandler, historyStore };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task worker result handler', () => {
  it('T-TW-RH1 records success result and completes node', () => {
    const harness = createHarness(path.join(tmpRoot, 'success'));
    const claim = harness.claimService.claimWork({
      taskGraphId: 'tg-1',
      taskNodeId: 'node-a',
      workerId: 'default-local-worker',
      claimAttemptIndex: 0,
    }).claim;

    harness.resultHandler.handleResult({
      taskGraphId: 'tg-1',
      executionRunId: 'er-1',
      taskNodeId: 'node-a',
      workerId: 'default-local-worker',
      claimId: claim.claimId,
      attemptIndex: claim.attemptIndex,
      resultType: 'SUCCESS',
      resultPayload: { output: 'ok' },
    });

    expect(harness.projection.projectOne({ taskGraphId: 'tg-1' }).nodeStates['node-a']).toBe('completed');
  });

  it('T-TW-RH2 records failure and schedules retry when eligible', () => {
    const harness = createHarness(path.join(tmpRoot, 'failure-retry'));
    const claim = harness.claimService.claimWork({
      taskGraphId: 'tg-1',
      taskNodeId: 'node-a',
      workerId: 'default-local-worker',
      claimAttemptIndex: 0,
    }).claim;

    const result = harness.resultHandler.handleResult({
      taskGraphId: 'tg-1',
      executionRunId: 'er-1',
      taskNodeId: 'node-a',
      workerId: 'default-local-worker',
      claimId: claim.claimId,
      attemptIndex: claim.attemptIndex,
      resultType: 'RETRY_REQUESTED',
      resultPayload: { error: 'transient' },
      failureClass: 'RETRYABLE_FAILURE',
      retryEligible: true,
    });

    expect(result.retryScheduled).toBe(true);
    expect(harness.projection.projectOne({ taskGraphId: 'tg-1' }).retryAttempts.length).toBeGreaterThan(0);
  });

  it('T-TW-RH3 deterministic replay produces identical history', () => {
    const first = createHarness(path.join(tmpRoot, 'det-a'));
    const second = createHarness(path.join(tmpRoot, 'det-b'));

    for (const harness of [first, second]) {
      const claim = harness.claimService.claimWork({
        taskGraphId: 'tg-1',
        taskNodeId: 'node-a',
        workerId: 'default-local-worker',
        claimAttemptIndex: 0,
      }).claim;

      harness.resultHandler.handleResult({
        taskGraphId: 'tg-1',
        executionRunId: 'er-1',
        taskNodeId: 'node-a',
        workerId: 'default-local-worker',
        claimId: claim.claimId,
        attemptIndex: claim.attemptIndex,
        resultType: 'SUCCESS',
        resultPayload: { output: 'ok' },
      });
    }

    const firstPath = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: 'er-1',
      rootDir: path.join(tmpRoot, 'det-a', 'artifacts'),
    }).historyJsonPath;

    const secondPath = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: 'er-1',
      rootDir: path.join(tmpRoot, 'det-b', 'artifacts'),
    }).historyJsonPath;

    expect(fs.readFileSync(firstPath, 'utf8')).toBe(fs.readFileSync(secondPath, 'utf8'));
  });
});
