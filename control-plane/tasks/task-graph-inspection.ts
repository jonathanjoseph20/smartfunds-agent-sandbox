import {
  createImplementationTaskGraphManager,
  type ImplementationTaskGraphManager,
} from './task-graph-manager.ts';
import {
  createImplementationTaskGraphMaterializer,
  type ImplementationTaskGraphMaterializer,
} from './task-graph-materializer.ts';

export function createImplementationTaskGraphInspection(options: {
  manager?: ImplementationTaskGraphManager;
  materializer?: ImplementationTaskGraphMaterializer;
  taskGraphsFilePath?: string;
  historyFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
  artifactsRoot?: string;
} = {}) {
  const manager = options.manager ?? createImplementationTaskGraphManager({
    taskGraphsFilePath: options.taskGraphsFilePath,
    historyFilePath: options.historyFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const materializer = options.materializer ?? createImplementationTaskGraphMaterializer({
    manager,
    artifactsRoot: options.artifactsRoot,
    taskGraphsFilePath: options.taskGraphsFilePath,
    historyFilePath: options.historyFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function createTaskGraph(input: { planId: string }) {
    return manager.createImplementationTaskGraph(input).projection;
  }

  function listTaskGraphs() {
    return manager.listImplementationTaskGraphProjections();
  }

  function inspectTaskGraph(input: { taskGraphId: string }) {
    return manager.deriveImplementationTaskGraphProjection(input.taskGraphId);
  }

  function materializeTaskGraph(input: { taskGraphId: string }) {
    return materializer.materializeImplementationTaskGraph(input.taskGraphId);
  }

  return {
    createTaskGraph,
    listTaskGraphs,
    inspectTaskGraph,
    materializeTaskGraph,
  };
}

export type ImplementationTaskGraphInspection = ReturnType<typeof createImplementationTaskGraphInspection>;
