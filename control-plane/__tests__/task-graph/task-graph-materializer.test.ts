import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskGraphMaterializer } from '../../task-graph/task-graph-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-graph-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function projected() {
  return {
    taskGraphId: 'tg-1',
    executionEngineRunId: 'er-1',
    executionAttemptId: 'ea-1',
    runtimeEnvelopeId: 're-1',
    executionContractId: 'ec-1',
    missionId: 'm-1',
    taskNodes: [{ taskNodeId: 'n-1', taskState: 'ready' }],
    taskEdges: [{ taskEdgeId: 'e-1', dependencyType: 'finish_to_start' }],
    graphState: 'ready_for_execution',
    graphEligibilityState: 'eligible',
    nodeCount: 1,
    edgeCount: 1,
    blockingReasons: [],
    limitations: ['task_graph_structure_only_sprint_6_1'],
    provenanceInputs: {
      engineState: 'eligible_to_start',
      engineEligibilityState: 'eligible',
      engineBlockingReasons: [],
      engineLimitations: [],
      runtimeEnvelopeState: 'ready_for_runtime',
      runtimeEnvelopeEligibility: 'eligible',
      runtimeEnvelopeLimitations: [],
      runtimeEnvelopeBlockers: [],
    },
    historySummary: { totalEvents: 1 },
    nodeStateCounts: {
      pending: 0,
      ready: 1,
      running: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      skipped: 0,
    },
    readyNodeCount: 1,
    runningNodeCount: 0,
    completedNodeCount: 0,
    blockedNodeCount: 0,
    statusPreview: { taskGraphId: 'tg-1', graphState: 'ready_for_execution' },
    reportPreview: { taskGraphId: 'tg-1' },
    artifactPaths: {
      dirPath: path.join(tmpRoot, 'artifacts', 'tg-1'),
      statusJsonPath: path.join(tmpRoot, 'artifacts', 'tg-1', 'task-graph-status.json'),
      reportJsonPath: path.join(tmpRoot, 'artifacts', 'tg-1', 'task-graph-report.json'),
      reportMarkdownPath: path.join(tmpRoot, 'artifacts', 'tg-1', 'task-graph-report.md'),
      historyJsonPath: path.join(tmpRoot, 'artifacts', 'tg-1', 'task-graph-history.json'),
      nodesJsonPath: path.join(tmpRoot, 'artifacts', 'tg-1', 'task-graph-nodes.json'),
      edgesJsonPath: path.join(tmpRoot, 'artifacts', 'tg-1', 'task-graph-edges.json'),
    },
  };
}

describe('task graph materializer', () => {
  it('T-MTG-M1 repeated materialization is deterministic', () => {
    const projection = {
      projectOne: () => projected(),
    };

    const historyStore = {
      append: () => ({ appended: true }),
      load: () => ({
        taskGraphId: 'tg-1',
        executionEngineRunId: 'er-1',
        executionAttemptId: 'ea-1',
        runtimeEnvelopeId: 're-1',
        executionContractId: 'ec-1',
        missionId: 'm-1',
        entries: [],
      }),
    };

    const materializer = createTaskGraphMaterializer({
      projection: projection as never,
      historyStore: historyStore as never,
      taskGraphArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const first = materializer.materializeOne({ taskGraphId: 'tg-1' });
    const second = materializer.materializeOne({ taskGraphId: 'tg-1' });

    const firstSnapshot = {
      status: fs.readFileSync(first.statusPath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.markdownPath, 'utf8'),
      history: fs.readFileSync(first.historyPath, 'utf8'),
      nodes: fs.readFileSync(first.nodesPath, 'utf8'),
      edges: fs.readFileSync(first.edgesPath, 'utf8'),
    };

    const secondSnapshot = {
      status: fs.readFileSync(second.statusPath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.markdownPath, 'utf8'),
      history: fs.readFileSync(second.historyPath, 'utf8'),
      nodes: fs.readFileSync(second.nodesPath, 'utf8'),
      edges: fs.readFileSync(second.edgesPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
  });
});
