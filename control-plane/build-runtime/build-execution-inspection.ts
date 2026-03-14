import {
  createBuildExecutionManager,
  type BuildExecutionManager,
} from './build-execution-manager.ts';
import {
  createBuildExecutionMaterializer,
  type BuildExecutionMaterializer,
} from './build-execution-materializer.ts';

export function createBuildExecutionInspection(options: {
  manager?: BuildExecutionManager;
  materializer?: BuildExecutionMaterializer;
  runsFilePath?: string;
  historyFilePath?: string;
  packetsFilePath?: string;
  packetHistoryFilePath?: string;
  bundlesFilePath?: string;
  bundleHistoryFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
  artifactsRoot?: string;
} = {}) {
  const manager = options.manager ?? createBuildExecutionManager({
    runsFilePath: options.runsFilePath,
    historyFilePath: options.historyFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesFilePath: options.bundlesFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const materializer = options.materializer ?? createBuildExecutionMaterializer({
    manager,
    artifactsRoot: options.artifactsRoot,
    runsFilePath: options.runsFilePath,
    historyFilePath: options.historyFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    bundlesFilePath: options.bundlesFilePath,
    bundleHistoryFilePath: options.bundleHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function listBuildExecutionRuns() {
    return manager.listBuildExecutionRunProjections();
  }

  function getBuildExecutionRun(runId: string) {
    return manager.getBuildExecutionRun(runId);
  }

  function inspectBuildExecutionRun(runId: string) {
    const run = manager.getBuildExecutionRun(runId);
    const validation = manager.validateBuildExecutionRun(runId);
    const projection = manager.deriveBuildExecutionProjection(runId);
    const history = manager.historyStore.listBuildExecutionEvents(runId);

    return {
      run,
      validation,
      projection,
      history,
    };
  }

  function materializeBuildExecutionRun(input: { runId: string }) {
    return materializer.materializeBuildExecutionArtifacts(input.runId);
  }

  return {
    listBuildExecutionRuns,
    getBuildExecutionRun,
    inspectBuildExecutionRun,
    materializeBuildExecutionRun,
  };
}

export type BuildExecutionInspection = ReturnType<typeof createBuildExecutionInspection>;
