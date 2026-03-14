import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createRepoScaffoldMaterializer } from '../../repo-scaffold/repo-scaffold-materializer.ts';
import { createRepoScaffoldManager } from '../../repo-scaffold/repo-scaffold-manager.ts';
import { createCodexExecutionPacketManager } from '../../codex/codex-execution-packet-manager.ts';
import { createEngineeringPlanManager } from '../../engineering/engineering-plan-manager.ts';
import { createImplementationTaskGraphInspection } from '../../tasks/task-graph-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'repo-scaffold', 'tmp-repo-scaffold-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('repo scaffold materializer', () => {
  it('T-PF5-M1 emits required artifact files deterministically and never writes to repoTarget', () => {
    const plansFilePath = path.join(tmpRoot, 'state', 'engineering-plans.json');
    const engineeringHistoryFilePath = path.join(tmpRoot, 'state', 'engineering-plan-history.json');
    const taskGraphsFilePath = path.join(tmpRoot, 'state', 'implementation-task-graphs.json');
    const taskGraphHistoryFilePath = path.join(tmpRoot, 'state', 'implementation-task-graph-history.json');
    const packetsFilePath = path.join(tmpRoot, 'state', 'codex-execution-packets.json');
    const packetHistoryFilePath = path.join(tmpRoot, 'state', 'codex-execution-packet-history.json');
    const bundlesFilePath = path.join(tmpRoot, 'state', 'repo-scaffold-bundles.json');
    const bundleHistoryFilePath = path.join(tmpRoot, 'state', 'repo-scaffold-history.json');
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'repo-scaffold');

    const engineeringManager = createEngineeringPlanManager({
      plansFilePath,
      historyFilePath: engineeringHistoryFilePath,
    });

    const plan = engineeringManager.createEngineeringPlan({
      specId: 'spec-1',
      architectureSummary: 'Service + queue',
      subsystems: ['api'],
      implementationPhases: ['phase-1'],
      dependencies: ['db'],
      integrationRequirements: ['auth'],
      testStrategy: 'unit',
      constraints: ['deterministic'],
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

    const packetSummary = packetManager.createCodexExecutionPackets(graph.taskGraphId);
    const packetId = packetSummary.packetIds[0]!;

    const manager = createRepoScaffoldManager({
      bundlesFilePath,
      historyFilePath: bundleHistoryFilePath,
      packetsFilePath,
      packetHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
    });

    const created = manager.createRepoScaffoldBundles(packetId);
    const before = manager.getRepoScaffoldBundle(created.bundleId);

    const materializer = createRepoScaffoldMaterializer({
      manager,
      artifactsRoot,
      bundlesFilePath,
      historyFilePath: bundleHistoryFilePath,
      packetsFilePath,
      packetHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
    });

    const first = materializer.materializeRepoScaffoldBundle(created.bundleId);
    const second = materializer.materializeRepoScaffoldBundle(created.bundleId);

    expect(fs.existsSync(first.bundlePath)).toBe(true);
    expect(fs.existsSync(first.statusPath)).toBe(true);
    expect(fs.existsSync(first.validationPath)).toBe(true);
    expect(fs.existsSync(first.fileLayoutPath)).toBe(true);
    expect(fs.existsSync(first.patchPlanPath)).toBe(true);
    expect(fs.existsSync(first.reportPath)).toBe(true);

    expect(fs.readFileSync(first.bundlePath, 'utf8')).toBe(fs.readFileSync(second.bundlePath, 'utf8'));
    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.readFileSync(first.validationPath, 'utf8')).toBe(fs.readFileSync(second.validationPath, 'utf8'));

    const report = fs.readFileSync(first.reportPath, 'utf8');
    expect(report).toContain('# Repository Scaffold Report');
    expect(report).toContain(`- bundleId: ${created.bundleId}`);

    const after = manager.getRepoScaffoldBundle(created.bundleId);
    expect(after).toEqual(before);

    expect(fs.existsSync(path.join(tmpRoot, 'src'))).toBe(false);
    expect(fs.existsSync(path.join(tmpRoot, 'tests'))).toBe(false);
  });
});
