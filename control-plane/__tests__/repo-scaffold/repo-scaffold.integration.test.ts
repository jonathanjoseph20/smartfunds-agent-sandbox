import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCodexExecutionPacketManager } from '../../codex/codex-execution-packet-manager.ts';
import { createEngineeringPlanManager } from '../../engineering/engineering-plan-manager.ts';
import { createProductSpecManager } from '../../products/product-spec-manager.ts';
import { createRepoScaffoldInspection } from '../../repo-scaffold/repo-scaffold-inspection.ts';
import { createRepoScaffoldManager } from '../../repo-scaffold/repo-scaffold-manager.ts';
import { createImplementationTaskGraphInspection } from '../../tasks/task-graph-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'repo-scaffold', 'tmp-repo-scaffold-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('repo scaffold integration', () => {
  it('T-PF5-INT1 runs ProductSpec -> EngineeringPlan -> TaskGraph -> CodexPackets -> RepoScaffold -> Materialization deterministically', () => {
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

    const productsManager = createProductSpecManager({
      specsFilePath,
      historyFilePath: specHistoryFilePath,
    });

    const spec = productsManager.createProductSpec({
      name: 'Repo Scaffold PF5',
      problem: 'Need deterministic pre-execution scaffold bundles.',
      targetUser: 'Operator',
      solution: 'Create bounded scaffold derivations from packets.',
      architectureSummary: 'Control-plane deterministic derivation path.',
      mvpScope: 'PF5 scaffold create/list/inspect/materialize',
      originMissionIds: ['mission-pf5'],
    });

    const engineeringManager = createEngineeringPlanManager({
      plansFilePath,
      historyFilePath: engineeringHistoryFilePath,
    });

    const plan = engineeringManager.createEngineeringPlan({
      specId: spec.specId,
      architectureSummary: 'Product -> Plan -> Graph -> Packet -> Scaffold',
      subsystems: ['control-plane'],
      implementationPhases: ['phase-1', 'phase-2'],
      dependencies: ['codex-packets'],
      integrationRequirements: ['deterministic-json'],
      testStrategy: 'unit + integration',
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

    const scaffoldInspection = createRepoScaffoldInspection({
      manager: scaffoldManager,
      bundlesFilePath,
      historyFilePath: bundleHistoryFilePath,
      packetsFilePath,
      packetHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'repo-scaffold'),
    });

    const createdFirst = scaffoldManager.createRepoScaffoldBundles(packetId);
    const createdSecond = scaffoldManager.createRepoScaffoldBundles(packetId);

    expect(createdFirst.bundleId).toBe(createdSecond.bundleId);

    const listed = scaffoldInspection.listRepoScaffoldBundles();
    expect(listed.some((entry) => entry.bundleId === createdFirst.bundleId)).toBe(true);

    const inspected = scaffoldInspection.inspectRepoScaffoldBundle(createdFirst.bundleId);
    expect(inspected.bundle.packetId).toBe(packetId);
    expect(['draft', 'validated', 'blocked', 'ready']).toContain(inspected.status);

    const materialized = scaffoldInspection.materializeRepoScaffoldBundle({ bundleId: createdFirst.bundleId });
    expect(fs.existsSync(materialized.bundlePath)).toBe(true);
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.validationPath)).toBe(true);
    expect(fs.existsSync(materialized.fileLayoutPath)).toBe(true);
    expect(fs.existsSync(materialized.patchPlanPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);

    const report = fs.readFileSync(materialized.reportPath, 'utf8');
    expect(report).toContain('# Repository Scaffold Report');
    expect(report).toContain(`- packetId: ${packetId}`);
  });
});
