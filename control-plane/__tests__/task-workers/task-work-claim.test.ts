import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskExecutionHistoryStore } from '../../task-execution/task-execution-history-store.ts';
import { createTaskExecutionProjection } from '../../task-execution/task-execution-projection.ts';
import { createTaskWorkClaimService } from '../../task-execution/task-work-claim.ts';
import type { MissionTaskGraphProjection } from '../../task-graph/task-graph-types.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-workers-claim');

function makeTaskGraph(requiredCapabilities: string[] = ['filesystem']): MissionTaskGraphProjection {
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
      requiredCapabilities,
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

function createHarness(requiredCapabilities: string[] = ['filesystem']) {
  const taskGraph = makeTaskGraph(requiredCapabilities);
  const taskGraphProjection = {
    projectOne: () => taskGraph,
    projectAll: () => [taskGraph],
    summarizeList: () => [{ taskGraphId: taskGraph.taskGraphId }],
  };

  const historyStore = createTaskExecutionHistoryStore({ artifactsRoot: path.join(tmpRoot, 'artifacts') });
  const projection = createTaskExecutionProjection({
    taskGraphProjection: taskGraphProjection as never,
    historyStore,
    taskExecutionArtifactsRoot: path.join(tmpRoot, 'artifacts'),
  });

  const claimService = createTaskWorkClaimService({
    projection,
    historyStore,
    taskGraphProjection: taskGraphProjection as never,
    taskExecutionArtifactsRoot: path.join(tmpRoot, 'artifacts'),
  });

  return { claimService };
}

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('task work claim', () => {
  it('T-TW-C1 valid claim appends deterministic claim event', () => {
    const { claimService } = createHarness();

    const claimed = claimService.claimWork({
      taskGraphId: 'tg-1',
      taskNodeId: 'node-a',
      workerId: 'default-local-worker',
      claimAttemptIndex: 0,
    });

    expect(claimed.appended).toBe(true);
    expect(claimed.claim.taskNodeId).toBe('node-a');
    expect(claimed.claim.claimId).toHaveLength(64);
  });

  it('T-TW-C2 duplicate claim is rejected', () => {
    const { claimService } = createHarness();

    claimService.claimWork({ taskGraphId: 'tg-1', taskNodeId: 'node-a', workerId: 'default-local-worker', claimAttemptIndex: 0 });

    expect(() => claimService.claimWork({
      taskGraphId: 'tg-1',
      taskNodeId: 'node-a',
      workerId: 'default-local-worker',
      claimAttemptIndex: 1,
    })).toThrow('INVALID_TASK_WORK_CLAIM');
  });

  it('T-TW-C3 capability mismatch is rejected', () => {
    const { claimService } = createHarness(['gpu']);

    expect(() => claimService.claimWork({
      taskGraphId: 'tg-1',
      taskNodeId: 'node-a',
      workerId: 'default-local-worker',
      claimAttemptIndex: 0,
    })).toThrow('INVALID_TASK_WORK_CLAIM');
  });
});
