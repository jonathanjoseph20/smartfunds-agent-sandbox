import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  resolveTaskOrchestrationArtifactPaths,
  ensureTaskOrchestrationArtifactDir,
} from './task-orchestration-history-store.ts';
import {
  createTaskOrchestrationProjection,
  type TaskOrchestrationProjectionEngine,
} from './task-orchestration-projection.ts';
import {
  createTaskOrchestrationHistoryStore,
  type TaskOrchestrationHistoryStore,
} from './task-orchestration-history-store.ts';

function toMarkdownReport(input: {
  executionRunId: string;
  taskGraphId: string;
  cycleState: string;
  currentCycleIndex: number;
  assignments: number;
  deferred: number;
  workers: number;
}): string {
  const lines = [
    '# Task Orchestration Report',
    '',
    `Execution Run: ${input.executionRunId}`,
    `Task Graph: ${input.taskGraphId}`,
    `Cycle Index: ${String(input.currentCycleIndex)}`,
    `Cycle State: ${input.cycleState}`,
    '',
    '## Counts',
    `- assignments: ${String(input.assignments)}`,
    `- deferred: ${String(input.deferred)}`,
    `- workers: ${String(input.workers)}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify(input),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function createTaskOrchestrationMaterializer(options: {
  projection?: TaskOrchestrationProjectionEngine;
  historyStore?: TaskOrchestrationHistoryStore;
  taskExecutionArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createTaskOrchestrationProjection({
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
  });
  const historyStore = options.historyStore ?? createTaskOrchestrationHistoryStore({
    artifactsRoot: options.taskExecutionArtifactsRoot,
  });

  function materializeOne(input: { executionRunId: string; taskGraphId: string }) {
    const state = projection.projectOne(input);
    ensureTaskOrchestrationArtifactDir({
      executionRunId: input.executionRunId,
      rootDir: options.taskExecutionArtifactsRoot,
    });

    const paths = resolveTaskOrchestrationArtifactPaths({
      executionRunId: input.executionRunId,
      rootDir: options.taskExecutionArtifactsRoot,
    });

    const statusPayload = {
      executionRunId: state.executionRunId,
      taskGraphId: state.taskGraphId,
      currentCycleIndex: state.currentCycleIndex,
      cycleState: state.cycleState,
      assignmentCount: state.assignments.length,
      deferredCount: state.deferredNodes.length,
      workerQueueCount: state.workerQueues.length,
    };

    const reportPayload = {
      executionRunId: state.executionRunId,
      taskGraphId: state.taskGraphId,
      cycles: state.cycles,
      assignments: state.assignments,
      deferredNodes: state.deferredNodes,
      workerQueues: state.workerQueues,
      workerLoad: state.workerLoad,
    };

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(statusPayload)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(reportPayload)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      executionRunId: state.executionRunId,
      taskGraphId: state.taskGraphId,
      cycleState: state.cycleState,
      currentCycleIndex: state.currentCycleIndex,
      assignments: state.assignments.length,
      deferred: state.deferredNodes.length,
      workers: state.workerQueues.length,
    }), 'utf8');
    const history = historyStore.load({
      executionRunId: state.executionRunId,
      taskGraphId: state.taskGraphId,
    });
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.assignmentsJsonPath, `${canonicalStringify(state.assignments)}\n`, 'utf8');
    fs.writeFileSync(paths.queuesJsonPath, `${canonicalStringify(state.workerQueues)}\n`, 'utf8');
    fs.writeFileSync(paths.deferralsJsonPath, `${canonicalStringify(state.deferredNodes)}\n`, 'utf8');

    return {
      executionRunId: state.executionRunId,
      taskGraphId: state.taskGraphId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      assignmentsPath: paths.assignmentsJsonPath,
      queuesPath: paths.queuesJsonPath,
      deferralsPath: paths.deferralsJsonPath,
    };
  }

  return {
    materializeOne,
  };
}

export type TaskOrchestrationMaterializer = ReturnType<typeof createTaskOrchestrationMaterializer>;
