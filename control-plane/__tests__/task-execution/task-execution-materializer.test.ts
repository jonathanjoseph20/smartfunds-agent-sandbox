import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createTaskExecutionMaterializer } from '../../task-execution/task-execution-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tmp-task-execution-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

function projected() {
  return {
    executionEngineRunId: 'er-1',
    executionAttemptId: 'ea-1',
    taskGraphId: 'tg-1',
    executionStepCount: 3,
    failedNodeCount: 0,
    retryingNodeCount: 0,
    readyNodeCount: 0,
    runningNodeCount: 0,
    completedNodeCount: 1,
    blockedNodeCount: 0,
    graphState: 'in_progress',
    executionProgress: {
      completed: 1,
      total: 2,
      ratio: 0.5,
    },
    blockingReasons: [],
    blockingNodes: [],
    lastExecutionStepId: 'step-3',
    engineState: 'active',
    steps: [{ executionStepId: 'step-1' }],
    nodeStates: {
      'node-a': 'completed',
      'node-b': 'ready',
    },
    retryAttempts: [],
    retryLimitBreaches: [],
    graphFailureState: 'none',
    statusPreview: {
      taskGraphId: 'tg-1',
      graphState: 'running',
    },
    reportPreview: {
      taskGraphId: 'tg-1',
      steps: [{ executionStepId: 'step-1' }],
    },
    artifactPaths: {
      dirPath: path.join(tmpRoot, 'artifacts', 'er-1'),
      statusJsonPath: path.join(tmpRoot, 'artifacts', 'er-1', 'task-execution-status.json'),
      reportJsonPath: path.join(tmpRoot, 'artifacts', 'er-1', 'task-execution-report.json'),
      reportMarkdownPath: path.join(tmpRoot, 'artifacts', 'er-1', 'task-execution-report.md'),
      historyJsonPath: path.join(tmpRoot, 'artifacts', 'er-1', 'task-execution-history.json'),
      stepsJsonPath: path.join(tmpRoot, 'artifacts', 'er-1', 'task-execution-steps.json'),
      progressJsonPath: path.join(tmpRoot, 'artifacts', 'er-1', 'task-execution-progress.json'),
      failuresJsonPath: path.join(tmpRoot, 'artifacts', 'er-1', 'task-execution-failures.json'),
      retriesJsonPath: path.join(tmpRoot, 'artifacts', 'er-1', 'task-execution-retries.json'),
      blockersJsonPath: path.join(tmpRoot, 'artifacts', 'er-1', 'task-execution-blockers.json'),
    },
    provenanceInputs: {
      taskGraphState: 'ready_for_execution',
      taskGraphNodeCount: 2,
      taskGraphEdgeCount: 1,
      taskGraphBlockingReasons: [],
    },
  };
}

describe('task execution materializer', () => {
  it('T-MTE-M1 writes expected files and repeated materialization is deterministic', () => {
    const projection = {
      projectOne: () => projected(),
    };

    const historyStore = {
      load: () => ({
        executionEngineRunId: 'er-1',
        executionAttemptId: 'ea-1',
        taskGraphId: 'tg-1',
        entries: [],
      }),
    };

    const materializer = createTaskExecutionMaterializer({
      projection: projection as never,
      historyStore: historyStore as never,
      taskExecutionArtifactsRoot: path.join(tmpRoot, 'artifacts'),
    });

    const first = materializer.materializeOne({ taskGraphId: 'tg-1' });
    const second = materializer.materializeOne({ taskGraphId: 'tg-1' });

    const firstSnapshot = {
      status: fs.readFileSync(first.statusPath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      markdown: fs.readFileSync(first.markdownPath, 'utf8'),
      history: fs.readFileSync(first.historyPath, 'utf8'),
      steps: fs.readFileSync(first.stepsPath, 'utf8'),
      progress: fs.readFileSync(first.progressPath, 'utf8'),
      failures: fs.readFileSync(first.failuresPath, 'utf8'),
      retries: fs.readFileSync(first.retriesPath, 'utf8'),
      blockers: fs.readFileSync(first.blockersPath, 'utf8'),
    };

    const secondSnapshot = {
      status: fs.readFileSync(second.statusPath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      markdown: fs.readFileSync(second.markdownPath, 'utf8'),
      history: fs.readFileSync(second.historyPath, 'utf8'),
      steps: fs.readFileSync(second.stepsPath, 'utf8'),
      progress: fs.readFileSync(second.progressPath, 'utf8'),
      failures: fs.readFileSync(second.failuresPath, 'utf8'),
      retries: fs.readFileSync(second.retriesPath, 'utf8'),
      blockers: fs.readFileSync(second.blockersPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
  });
});
