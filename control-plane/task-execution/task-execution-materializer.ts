import fs from 'node:fs';

import { canonicalStringify } from '../finance/determinism.ts';

import {
  createTaskExecutionHistoryStore,
  ensureTaskExecutionArtifactDir,
  resolveTaskExecutionArtifactPaths,
  type TaskExecutionHistoryStore,
} from './task-execution-history-store.ts';
import {
  createTaskExecutionProjection,
  type TaskExecutionProjectionEngine,
} from './task-execution-projection.ts';
import {
  createTaskOrchestrationMaterializer,
  type TaskOrchestrationMaterializer,
} from './task-orchestration-materializer.ts';
import type { MissionTaskExecutionMaterializationSummary } from './task-execution-step-types.ts';

function toMarkdownReport(input: {
  executionEngineRunId: string;
  executionAttemptId: string;
  taskGraphId: string;
  graphState: string;
  engineState: string;
  executionStepCount: number;
  readyNodeCount: number;
  runningNodeCount: number;
  completedNodeCount: number;
  blockedNodeCount: number;
  executionProgress: {
    completed: number;
    total: number;
    ratio: number;
  };
  blockingReasons: string[];
  lastExecutionStepId: string | null;
}): string {
  const lines = [
    '# Mission Task Execution Report',
    '',
    `Execution Engine Run: ${input.executionEngineRunId}`,
    `Execution Attempt: ${input.executionAttemptId}`,
    `Task Graph: ${input.taskGraphId}`,
    `Engine State: ${input.engineState}`,
    `Graph State: ${input.graphState}`,
    '',
    '## Counts',
    `- executionStepCount: ${String(input.executionStepCount)}`,
    `- readyNodeCount: ${String(input.readyNodeCount)}`,
    `- runningNodeCount: ${String(input.runningNodeCount)}`,
    `- completedNodeCount: ${String(input.completedNodeCount)}`,
    `- blockedNodeCount: ${String(input.blockedNodeCount)}`,
    '',
    '## Progress',
    `- completed: ${String(input.executionProgress.completed)}`,
    `- total: ${String(input.executionProgress.total)}`,
    `- ratio: ${String(input.executionProgress.ratio)}`,
    '',
    '## Summary',
    `- blockingReasons: ${input.blockingReasons.join(', ') || 'none'}`,
    `- lastExecutionStepId: ${input.lastExecutionStepId ?? 'none'}`,
    '',
    '## Canonical JSON Payload',
    canonicalStringify(input),
    '',
  ];

  return `${lines.join('\n')}\n`;
}

export function createTaskExecutionMaterializer(options: {
  projection?: TaskExecutionProjectionEngine;
  historyStore?: TaskExecutionHistoryStore;
  orchestrationMaterializer?: TaskOrchestrationMaterializer;
  missionDefinitionsDir?: string;
  missionInstancesDir?: string;
  missionArtifactsRoot?: string;
  teamDefinitionsDir?: string;
  compatibilityArtifactsRoot?: string;
  assignmentArtifactsRoot?: string;
  activationArtifactsRoot?: string;
  executionContractArtifactsRoot?: string;
  runtimeEnvelopeArtifactsRoot?: string;
  executionAttemptArtifactsRoot?: string;
  executionJournalArtifactsRoot?: string;
  executionEngineArtifactsRoot?: string;
  taskGraphArtifactsRoot?: string;
  taskExecutionArtifactsRoot?: string;
} = {}) {
  const projection = options.projection ?? createTaskExecutionProjection({
    missionDefinitionsDir: options.missionDefinitionsDir,
    missionInstancesDir: options.missionInstancesDir,
    missionArtifactsRoot: options.missionArtifactsRoot,
    teamDefinitionsDir: options.teamDefinitionsDir,
    compatibilityArtifactsRoot: options.compatibilityArtifactsRoot,
    assignmentArtifactsRoot: options.assignmentArtifactsRoot,
    activationArtifactsRoot: options.activationArtifactsRoot,
    executionContractArtifactsRoot: options.executionContractArtifactsRoot,
    runtimeEnvelopeArtifactsRoot: options.runtimeEnvelopeArtifactsRoot,
    executionAttemptArtifactsRoot: options.executionAttemptArtifactsRoot,
    executionJournalArtifactsRoot: options.executionJournalArtifactsRoot,
    executionEngineArtifactsRoot: options.executionEngineArtifactsRoot,
    taskGraphArtifactsRoot: options.taskGraphArtifactsRoot,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
  });

  const historyStore = options.historyStore ?? createTaskExecutionHistoryStore({
    artifactsRoot: options.taskExecutionArtifactsRoot,
  });
  const orchestrationMaterializer = options.orchestrationMaterializer ?? createTaskOrchestrationMaterializer({
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
  });

  function materializeOne(input: {
    taskGraphId: string;
  }): MissionTaskExecutionMaterializationSummary {
    const projected = projection.projectOne(input);

    ensureTaskExecutionArtifactDir({
      executionEngineRunId: projected.executionEngineRunId,
      rootDir: options.taskExecutionArtifactsRoot,
    });

    const paths = resolveTaskExecutionArtifactPaths({
      executionEngineRunId: projected.executionEngineRunId,
      rootDir: options.taskExecutionArtifactsRoot,
    });

    const history = historyStore.load({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
    });

    fs.writeFileSync(paths.statusJsonPath, `${canonicalStringify(projected.statusPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportJsonPath, `${canonicalStringify(projected.reportPreview)}\n`, 'utf8');
    fs.writeFileSync(paths.reportMarkdownPath, toMarkdownReport({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
      graphState: projected.graphState,
      engineState: projected.engineState,
      executionStepCount: projected.executionStepCount,
      readyNodeCount: projected.readyNodeCount,
      runningNodeCount: projected.runningNodeCount,
      completedNodeCount: projected.completedNodeCount,
      blockedNodeCount: projected.blockedNodeCount,
      executionProgress: projected.executionProgress,
      blockingReasons: projected.blockingReasons,
      lastExecutionStepId: projected.lastExecutionStepId,
    }), 'utf8');
    fs.writeFileSync(paths.historyJsonPath, `${canonicalStringify(history)}\n`, 'utf8');
    fs.writeFileSync(paths.stepsJsonPath, `${canonicalStringify(projected.steps)}\n`, 'utf8');
    fs.writeFileSync(paths.progressJsonPath, `${canonicalStringify(projected.executionProgress)}\n`, 'utf8');
    fs.writeFileSync(paths.failuresJsonPath, `${canonicalStringify({
      failedNodeCount: projected.failedNodeCount,
      graphFailureState: projected.graphFailureState,
      failures: projected.steps
        .filter((step) => step.stepType === 'node_execution_failed')
        .map((step) => ({
          taskNodeId: step.taskNodeId,
          failureClass: step.stepOutputs.failureClass,
        })),
    })}\n`, 'utf8');
    fs.writeFileSync(paths.retriesJsonPath, `${canonicalStringify({
      retryingNodeCount: projected.retryingNodeCount,
      retryAttempts: projected.retryAttempts,
      retryLimitBreaches: projected.retryLimitBreaches,
    })}\n`, 'utf8');
    fs.writeFileSync(paths.blockersJsonPath, `${canonicalStringify({
      blockedNodeCount: projected.blockedNodeCount,
      blockingNodes: projected.blockingNodes,
      blockingReasons: projected.blockingReasons,
    })}\n`, 'utf8');
    fs.writeFileSync(paths.concurrencyJsonPath, `${canonicalStringify({
      concurrencyPolicyId: projected.concurrencyPolicyId,
      maxConcurrentNodes: projected.maxConcurrentNodes,
      runnableNodeCount: projected.runnableNodeCount,
      scheduledNodeCount: projected.scheduledNodeCount,
      deferredNodeCount: projected.deferredNodeCount,
      activeConcurrencySlots: projected.activeConcurrencySlots,
      availableConcurrencySlots: projected.availableConcurrencySlots,
      currentWaveIndex: projected.currentWaveIndex,
      currentWaveNodeIds: projected.currentWaveNodeIds,
      deferredNodeIds: projected.deferredNodeIds,
      schedulingState: projected.schedulingState,
    })}\n`, 'utf8');
    fs.writeFileSync(paths.runnableSetJsonPath, `${canonicalStringify({
      executionEngineRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
      runnableNodeCount: projected.runnableNodeCount,
      runnableNodeIds: [...projected.currentWaveNodeIds, ...projected.deferredNodeIds]
        .sort((left, right) => left.localeCompare(right)),
      deferredNodeIds: projected.deferredNodeIds,
    })}\n`, 'utf8');
    fs.writeFileSync(paths.schedulingWavesJsonPath, `${canonicalStringify(projected.schedulingWaves)}\n`, 'utf8');
    const workerHistory = projected.workerHistory ?? [];
    const workerAssignments = projected.workerAssignments ?? {};
    const workerExecutionState = projected.workerExecutionState ?? {};
    fs.writeFileSync(paths.workerClaimsJsonPath, `${canonicalStringify({
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
      claimedNodeCount: projected.claimedNodeCount ?? 0,
      claims: workerHistory
        .filter((entry) => entry.eventType === 'task_node_claimed')
        .map((entry) => entry.eventPayload),
    })}\n`, 'utf8');
    fs.writeFileSync(paths.workerResultsJsonPath, `${canonicalStringify({
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
      completed: workerHistory
        .filter((entry) => entry.eventType === 'worker_execution_completed')
        .map((entry) => entry.eventPayload),
      failed: workerHistory
        .filter((entry) => entry.eventType === 'worker_execution_failed')
        .map((entry) => entry.eventPayload),
    })}\n`, 'utf8');
    fs.writeFileSync(paths.workerStateJsonPath, `${canonicalStringify({
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
      activeWorkerCount: projected.activeWorkerCount ?? 0,
      workerAssignments,
      workerExecutionState,
    })}\n`, 'utf8');
    const orchestrationMaterialized = orchestrationMaterializer.materializeOne({
      executionRunId: projected.executionEngineRunId,
      taskGraphId: projected.taskGraphId,
    });

    return {
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
      statusPath: paths.statusJsonPath,
      reportPath: paths.reportJsonPath,
      markdownPath: paths.reportMarkdownPath,
      historyPath: paths.historyJsonPath,
      stepsPath: paths.stepsJsonPath,
      progressPath: paths.progressJsonPath,
      failuresPath: paths.failuresJsonPath,
      retriesPath: paths.retriesJsonPath,
      blockersPath: paths.blockersJsonPath,
      concurrencyPath: paths.concurrencyJsonPath,
      runnableSetPath: paths.runnableSetJsonPath,
      schedulingWavesPath: paths.schedulingWavesJsonPath,
      workerClaimsPath: paths.workerClaimsJsonPath,
      workerResultsPath: paths.workerResultsJsonPath,
      workerStatePath: paths.workerStateJsonPath,
      orchestrationStatusPath: orchestrationMaterialized.statusPath,
      orchestrationReportPath: orchestrationMaterialized.reportPath,
      orchestrationMarkdownPath: orchestrationMaterialized.markdownPath,
      orchestrationHistoryPath: orchestrationMaterialized.historyPath,
      workerAssignmentsPath: orchestrationMaterialized.assignmentsPath,
      workerQueuesPath: orchestrationMaterialized.queuesPath,
      workerDeferralsPath: orchestrationMaterialized.deferralsPath,
    };
  }

  return {
    materializeOne,
  };
}

export type TaskExecutionMaterializer = ReturnType<typeof createTaskExecutionMaterializer>;
