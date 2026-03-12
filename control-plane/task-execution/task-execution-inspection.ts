import {
  createTaskExecutionEngine,
  type TaskExecutionEngine,
} from './task-execution-engine.ts';
import {
  createTaskExecutionHistoryStore,
  type TaskExecutionHistoryStore,
} from './task-execution-history-store.ts';
import {
  createTaskExecutionMaterializer,
  type TaskExecutionMaterializer,
} from './task-execution-materializer.ts';
import {
  createTaskExecutionProjection,
  type TaskExecutionProjectionEngine,
} from './task-execution-projection.ts';

export function createTaskExecutionInspection(options: {
  projection?: TaskExecutionProjectionEngine;
  historyStore?: TaskExecutionHistoryStore;
  engine?: TaskExecutionEngine;
  materializer?: TaskExecutionMaterializer;
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
  const historyStore = options.historyStore ?? createTaskExecutionHistoryStore({
    artifactsRoot: options.taskExecutionArtifactsRoot,
  });

  const projection = options.projection ?? createTaskExecutionProjection({
    historyStore,
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

  const engine = options.engine ?? createTaskExecutionEngine({
    projection,
    historyStore,
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

  const materializer = options.materializer ?? createTaskExecutionMaterializer({
    projection,
    historyStore,
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

  function listTaskExecutionRuns() {
    return projection.summarizeList();
  }

  function inspectTaskExecutionRun(input: { taskGraphId: string }) {
    return projection.projectOne(input);
  }

  function taskExecutionStatus(input: { taskGraphId: string }) {
    return projection.projectOne(input).statusPreview;
  }

  function taskExecutionHistory(input: { taskGraphId: string }) {
    const projected = projection.projectOne(input);
    return historyStore.load({
      executionEngineRunId: projected.executionEngineRunId,
      executionAttemptId: projected.executionAttemptId,
      taskGraphId: projected.taskGraphId,
    });
  }

  function stepTaskExecution(input: { taskGraphId: string }) {
    return engine.step(input);
  }

  function advanceTaskExecution(input: { taskGraphId: string }) {
    return engine.advance(input);
  }

  function simulateTaskExecution(input: { taskGraphId: string }) {
    return engine.simulate(input);
  }

  function materializeTaskExecution(input: { taskGraphId: string }) {
    return materializer.materializeOne(input);
  }

  return {
    listTaskExecutionRuns,
    inspectTaskExecutionRun,
    taskExecutionStatus,
    taskExecutionHistory,
    stepTaskExecution,
    advanceTaskExecution,
    simulateTaskExecution,
    materializeTaskExecution,
  };
}

export type TaskExecutionInspection = ReturnType<typeof createTaskExecutionInspection>;
