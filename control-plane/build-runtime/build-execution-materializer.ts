import {
  createBuildExecutionManager,
  type BuildExecutionManager,
} from './build-execution-manager.ts';

export function createBuildExecutionMaterializer(options: {
  manager?: BuildExecutionManager;
  artifactsRoot?: string;
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
    artifactsRoot: options.artifactsRoot,
  });

  function materializeBuildExecutionArtifacts(runId: string) {
    return manager.materializeBuildExecutionArtifacts(runId);
  }

  return {
    materializeBuildExecutionArtifacts,
  };
}

export type BuildExecutionMaterializer = ReturnType<typeof createBuildExecutionMaterializer>;
