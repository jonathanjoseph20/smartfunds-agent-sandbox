import {
  createTaskExecutionOrchestrator,
  type TaskExecutionOrchestrator,
} from './task-execution-orchestrator.ts';
import {
  createTaskOrchestrationProjection,
  type TaskOrchestrationProjectionEngine,
} from './task-orchestration-projection.ts';
import {
  createTaskOrchestrationMaterializer,
  type TaskOrchestrationMaterializer,
} from './task-orchestration-materializer.ts';

export function createTaskOrchestrationInspection(options: {
  orchestrator?: TaskExecutionOrchestrator;
  projection?: TaskOrchestrationProjectionEngine;
  materializer?: TaskOrchestrationMaterializer;
  taskExecutionArtifactsRoot?: string;
  workerDefinitionsDir?: string;
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
} = {}) {
  const projection = options.projection ?? createTaskOrchestrationProjection({
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
    workerDefinitionsDir: options.workerDefinitionsDir,
  });

  const orchestrator = options.orchestrator ?? createTaskExecutionOrchestrator({
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
    workerDefinitionsDir: options.workerDefinitionsDir,
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
  });

  const materializer = options.materializer ?? createTaskOrchestrationMaterializer({
    projection,
    taskExecutionArtifactsRoot: options.taskExecutionArtifactsRoot,
  });

  function orchestrationStatus(input: { executionRunId: string; taskGraphId: string }) {
    const state = projection.projectOne(input);
    return {
      executionRunId: state.executionRunId,
      taskGraphId: state.taskGraphId,
      currentCycleIndex: state.currentCycleIndex,
      cycleState: state.cycleState,
      assignmentCount: state.assignments.length,
      deferredCount: state.deferredNodes.length,
      workerQueueCount: state.workerQueues.length,
    };
  }

  function assignments(input: { executionRunId: string; taskGraphId: string }) {
    return projection.projectOne(input).assignments;
  }

  function queues(input: { executionRunId: string; taskGraphId: string }) {
    return projection.projectOne(input).workerQueues;
  }

  function deferrals(input: { executionRunId: string; taskGraphId: string }) {
    return projection.projectOne(input).deferredNodes;
  }

  function history(input: { executionRunId: string; taskGraphId: string }) {
    return projection.projectOne(input).cycles;
  }

  function load(input: { executionRunId: string; taskGraphId: string }) {
    return projection.projectOne(input);
  }

  function cycle(input: { taskGraphId: string; workerSchedulingPolicyId?: string }) {
    return orchestrator.cycle(input);
  }

  function orchestrate(input: { taskGraphId: string; workerSchedulingPolicyId?: string; maxCycles?: number }) {
    return orchestrator.orchestrate(input);
  }

  function assign(input: { taskGraphId: string; workerSchedulingPolicyId?: string }) {
    return orchestrator.assign(input);
  }

  function materialize(input: { executionRunId: string; taskGraphId: string }) {
    return materializer.materializeOne(input);
  }

  return {
    load,
    orchestrationStatus,
    assignments,
    queues,
    deferrals,
    history,
    cycle,
    orchestrate,
    assign,
    materialize,
  };
}

export type TaskOrchestrationInspection = ReturnType<typeof createTaskOrchestrationInspection>;
