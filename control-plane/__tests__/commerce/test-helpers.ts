import fs from 'node:fs';
import path from 'node:path';

import { createBuildEvidenceInspection } from '../../build-evidence/build-evidence-inspection.ts';
import { createBuildExecutionManager } from '../../build-runtime/build-execution-manager.ts';
import { createCodexExecutionPacketManager } from '../../codex/codex-execution-packet-manager.ts';
import { createEngineeringPlanManager } from '../../engineering/engineering-plan-manager.ts';
import { createProductSpecManager } from '../../products/product-spec-manager.ts';
import { createRepoScaffoldManager } from '../../repo-scaffold/repo-scaffold-manager.ts';
import { createImplementationTaskGraphInspection } from '../../tasks/task-graph-inspection.ts';

export type UpstreamFixture = {
  paths: {
    specsFilePath: string;
    specHistoryFilePath: string;
    plansFilePath: string;
    engineeringHistoryFilePath: string;
    taskGraphsFilePath: string;
    taskGraphHistoryFilePath: string;
    packetsFilePath: string;
    packetHistoryFilePath: string;
    bundlesFilePath: string;
    bundleHistoryFilePath: string;
    runsFilePath: string;
    runHistoryFilePath: string;
    evidenceBundlesFilePath: string;
    evidenceHistoryFilePath: string;
  };
  ids: {
    specId: string;
    planId: string;
    taskGraphId: string;
    packetId: string;
    bundleId: string;
    runId: string;
    buildEvidenceBundleId: string;
  };
};

export function createUpstreamFixture(tmpRoot: string): UpstreamFixture {
  const specsFilePath = path.join(tmpRoot, 'state', 'product-specs.json');
  const specHistoryFilePath = path.join(tmpRoot, 'state', 'product-spec-history.json');
  const plansFilePath = path.join(tmpRoot, 'state', 'engineering-plans.json');
  const engineeringHistoryFilePath = path.join(tmpRoot, 'state', 'engineering-plan-history.json');
  const taskGraphsFilePath = path.join(tmpRoot, 'state', 'implementation-task-graphs.json');
  const taskGraphHistoryFilePath = path.join(tmpRoot, 'state', 'implementation-task-graph-history.json');
  const packetsFilePath = path.join(tmpRoot, 'state', 'codex-execution-packets.json');
  const packetHistoryFilePath = path.join(tmpRoot, 'state', 'codex-execution-packet-history.json');
  const bundlesFilePath = path.join(tmpRoot, 'state', 'repo-scaffold-bundles.json');
  const bundleHistoryFilePath = path.join(tmpRoot, 'state', 'repo-scaffold-history.json');
  const runsFilePath = path.join(tmpRoot, 'state', 'build-execution-runs.json');
  const runHistoryFilePath = path.join(tmpRoot, 'state', 'build-execution-history.json');
  const evidenceBundlesFilePath = path.join(tmpRoot, 'state', 'build-evidence-bundles.json');
  const evidenceHistoryFilePath = path.join(tmpRoot, 'state', 'build-evidence-history.json');

  const productManager = createProductSpecManager({
    specsFilePath,
    historyFilePath: specHistoryFilePath,
  });

  const spec = productManager.createProductSpec({
    name: 'Commerce PF8',
    problem: 'Need deterministic monetization layer.',
    targetUser: 'Operator',
    solution: 'Deterministic commerce projection.',
    architectureSummary: 'Product -> Plan -> Graph -> Packet -> Scaffold -> Build -> Evidence -> Commerce',
    mvpScope: 'PF8',
    originMissionIds: ['mission-pf8'],
  });

  const engineeringManager = createEngineeringPlanManager({
    plansFilePath,
    historyFilePath: engineeringHistoryFilePath,
  });

  const plan = engineeringManager.createEngineeringPlan({
    specId: spec.specId,
    architectureSummary: 'Deterministic commerce integration',
    subsystems: ['control-plane'],
    implementationPhases: ['phase-1'],
    dependencies: ['build-evidence'],
    integrationRequirements: ['canonical-json'],
    testStrategy: 'unit+integration',
    constraints: ['no-randomness'],
  });

  const taskInspection = createImplementationTaskGraphInspection({
    plansFilePath,
    engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
    taskGraphsFilePath,
    historyFilePath: taskGraphHistoryFilePath,
    artifactsRoot: path.join(tmpRoot, 'artifacts', 'tasks'),
  });

  const graph = taskInspection.createTaskGraph({ planId: plan.planId });

  const packetManager = createCodexExecutionPacketManager({
    packetsFilePath,
    historyFilePath: packetHistoryFilePath,
    taskGraphsFilePath,
    taskGraphHistoryFilePath,
    plansFilePath,
    engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
  });

  const packetCreate = packetManager.createCodexExecutionPackets(graph.taskGraphId);
  const packetId = packetCreate.packetIds[0]!;

  const scaffoldManager = createRepoScaffoldManager({
    bundlesFilePath,
    historyFilePath: bundleHistoryFilePath,
    packetsFilePath,
    packetHistoryFilePath,
    taskGraphsFilePath,
    taskGraphHistoryFilePath,
    plansFilePath,
    engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
  });

  const scaffold = scaffoldManager.createRepoScaffoldBundles(packetId);

  const buildManager = createBuildExecutionManager({
    runsFilePath,
    historyFilePath: runHistoryFilePath,
    packetsFilePath,
    packetHistoryFilePath,
    bundlesFilePath,
    bundleHistoryFilePath,
    taskGraphsFilePath,
    taskGraphHistoryFilePath,
    plansFilePath,
    engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
    artifactsRoot: path.join(tmpRoot, 'artifacts', 'build-runtime'),
  });

  const run = buildManager.createBuildExecutionRun(packetId, scaffold.bundleId);
  buildManager.executeBuildRun(run.runId);

  const evidenceInspection = createBuildEvidenceInspection({
    bundlesFilePath: evidenceBundlesFilePath,
    historyFilePath: evidenceHistoryFilePath,
    runsFilePath,
    runHistoryFilePath,
    packetsFilePath,
    packetHistoryFilePath,
    bundlesRuntimeFilePath: bundlesFilePath,
    bundleHistoryFilePath,
    taskGraphsFilePath,
    taskGraphHistoryFilePath,
    plansFilePath,
    engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
    artifactsRoot: path.join(tmpRoot, 'artifacts', 'build-evidence'),
  });

  const evidence = evidenceInspection.createEvidenceBundle({ runId: run.runId });
  evidenceInspection.verifyEvidenceBundle({ buildEvidenceBundleId: evidence.buildEvidenceBundleId });

  return {
    paths: {
      specsFilePath,
      specHistoryFilePath,
      plansFilePath,
      engineeringHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      packetsFilePath,
      packetHistoryFilePath,
      bundlesFilePath,
      bundleHistoryFilePath,
      runsFilePath,
      runHistoryFilePath,
      evidenceBundlesFilePath,
      evidenceHistoryFilePath,
    },
    ids: {
      specId: spec.specId,
      planId: plan.planId,
      taskGraphId: graph.taskGraphId,
      packetId,
      bundleId: scaffold.bundleId,
      runId: run.runId,
      buildEvidenceBundleId: evidence.buildEvidenceBundleId,
    },
  };
}

export function cleanupTmpRoot(tmpRoot: string): void {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
