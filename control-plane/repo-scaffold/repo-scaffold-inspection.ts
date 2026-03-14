import {
  createRepoScaffoldManager,
  type RepoScaffoldManager,
} from './repo-scaffold-manager.ts';
import {
  createRepoScaffoldMaterializer,
  type RepoScaffoldMaterializer,
} from './repo-scaffold-materializer.ts';
import { buildRepoScaffoldFileLayout } from './repo-scaffold-file-layout.ts';
import { buildRepoScaffoldPatchPlan } from './repo-scaffold-patch-plan.ts';

export function createRepoScaffoldInspection(options: {
  manager?: RepoScaffoldManager;
  materializer?: RepoScaffoldMaterializer;
  bundlesFilePath?: string;
  historyFilePath?: string;
  packetsFilePath?: string;
  packetHistoryFilePath?: string;
  taskGraphsFilePath?: string;
  taskGraphHistoryFilePath?: string;
  plansFilePath?: string;
  engineeringPlanHistoryFilePath?: string;
  artifactsRoot?: string;
} = {}) {
  const manager = options.manager ?? createRepoScaffoldManager({
    bundlesFilePath: options.bundlesFilePath,
    historyFilePath: options.historyFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  const materializer = options.materializer ?? createRepoScaffoldMaterializer({
    manager,
    artifactsRoot: options.artifactsRoot,
    bundlesFilePath: options.bundlesFilePath,
    historyFilePath: options.historyFilePath,
    packetsFilePath: options.packetsFilePath,
    packetHistoryFilePath: options.packetHistoryFilePath,
    taskGraphsFilePath: options.taskGraphsFilePath,
    taskGraphHistoryFilePath: options.taskGraphHistoryFilePath,
    plansFilePath: options.plansFilePath,
    engineeringPlanHistoryFilePath: options.engineeringPlanHistoryFilePath,
  });

  function listRepoScaffoldBundles() {
    return manager.listRepoScaffoldBundleProjections();
  }

  function getRepoScaffoldBundle(bundleId: string) {
    return manager.getRepoScaffoldBundle(bundleId);
  }

  function inspectRepoScaffoldBundle(bundleId: string) {
    const bundle = manager.getRepoScaffoldBundle(bundleId);
    const validation = manager.validateRepoScaffoldBundle(bundleId);
    const status = manager.deriveRepoScaffoldStatus(bundleId);
    const projection = manager.deriveRepoScaffoldProjection(bundleId);
    const history = manager.historyStore.listRepoScaffoldEvents(bundleId);

    return {
      bundle,
      validation,
      status,
      projection,
      fileLayout: buildRepoScaffoldFileLayout(bundle),
      patchPlan: buildRepoScaffoldPatchPlan(bundle),
      history,
    };
  }

  function materializeRepoScaffoldBundle(input: { bundleId: string }) {
    return materializer.materializeRepoScaffoldBundle(input.bundleId);
  }

  return {
    listRepoScaffoldBundles,
    getRepoScaffoldBundle,
    inspectRepoScaffoldBundle,
    materializeRepoScaffoldBundle,
  };
}

export type RepoScaffoldInspection = ReturnType<typeof createRepoScaffoldInspection>;
