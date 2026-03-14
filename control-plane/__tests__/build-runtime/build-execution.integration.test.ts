import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createBuildExecutionInspection } from '../../build-runtime/build-execution-inspection.ts';
import { createBuildExecutionManager } from '../../build-runtime/build-execution-manager.ts';
import { createCodexExecutionPacketManager } from '../../codex/codex-execution-packet-manager.ts';
import { createEngineeringPlanManager } from '../../engineering/engineering-plan-manager.ts';
import { createProductSpecManager } from '../../products/product-spec-manager.ts';
import { createRepoScaffoldManager } from '../../repo-scaffold/repo-scaffold-manager.ts';
import { createImplementationTaskGraphInspection } from '../../tasks/task-graph-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'build-runtime', 'tmp-build-execution-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('build execution integration', () => {
  it('T-PF6-INT1 runs ProductSpec -> EngineeringPlan -> TaskGraph -> CodexPackets -> RepoScaffold -> BuildExecution -> Materialization deterministically', () => {
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

    const productsManager = createProductSpecManager({
      specsFilePath,
      historyFilePath: specHistoryFilePath,
    });

    const spec = productsManager.createProductSpec({
      name: 'Build Runtime PF6',
      problem: 'Need deterministic build execution runtime.',
      targetUser: 'Operator',
      solution: 'Deterministic execution runtime and artifacts.',
      architectureSummary: 'Product -> Plan -> Graph -> Packet -> Scaffold -> BuildRun',
      mvpScope: 'PF6 control plane',
      originMissionIds: ['mission-pf6'],
    });

    const engineeringManager = createEngineeringPlanManager({
      plansFilePath,
      historyFilePath: engineeringHistoryFilePath,
    });

    const plan = engineeringManager.createEngineeringPlan({
      specId: spec.specId,
      architectureSummary: 'Deterministic pipeline',
      subsystems: ['control-plane'],
      implementationPhases: ['phase-1'],
      dependencies: ['codex-packets'],
      integrationRequirements: ['deterministic-json'],
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

    const scaffoldCreated = scaffoldManager.createRepoScaffoldBundles(packetId);

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

    const createdFirst = buildManager.createBuildExecutionRun(packetId, scaffoldCreated.bundleId);
    const createdSecond = buildManager.createBuildExecutionRun(packetId, scaffoldCreated.bundleId);

    expect(createdFirst.runId).toBe(createdSecond.runId);

    const validation = buildManager.validateBuildExecutionRun(createdFirst.runId);
    expect(['valid', 'warning']).toContain(validation.validationState);

    const executed = buildManager.executeBuildRun(createdFirst.runId);
    expect(executed.status).toBe('completed');
    expect(executed.artifactCount).toBeGreaterThan(0);

    const inspection = createBuildExecutionInspection({
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

    const materialized = inspection.materializeBuildExecutionRun({ runId: createdFirst.runId });

    expect(fs.existsSync(materialized.runPath)).toBe(true);
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.generatedArtifactsPath)).toBe(true);
    expect(fs.existsSync(materialized.executionStepsPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);

    const listed = inspection.listBuildExecutionRuns();
    expect(listed.some((entry) => entry.runId === createdFirst.runId)).toBe(true);

    const inspected = inspection.inspectBuildExecutionRun(createdFirst.runId);
    expect(inspected.projection.status).toBe('completed');

    const rerun = buildManager.createBuildExecutionRun(packetId, scaffoldCreated.bundleId);
    expect(rerun.runId).toBe(createdFirst.runId);
  });
});
