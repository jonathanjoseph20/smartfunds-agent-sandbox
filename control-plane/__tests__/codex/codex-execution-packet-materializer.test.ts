import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCodexExecutionPacketMaterializer } from '../../codex/codex-execution-packet-materializer.ts';
import { createCodexExecutionPacketManager } from '../../codex/codex-execution-packet-manager.ts';
import { createEngineeringPlanManager } from '../../engineering/engineering-plan-manager.ts';
import { createImplementationTaskGraphInspection } from '../../tasks/task-graph-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'codex', 'tmp-codex-execution-packet-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('codex execution packet materializer', () => {
  it('T-PF4-M1 writes deterministic artifacts and does not mutate canonical packet state', () => {
    const plansFilePath = path.join(tmpRoot, 'state', 'engineering-plans.json');
    const engineeringHistoryFilePath = path.join(tmpRoot, 'state', 'engineering-plan-history.json');
    const taskGraphsFilePath = path.join(tmpRoot, 'state', 'implementation-task-graphs.json');
    const taskGraphHistoryFilePath = path.join(tmpRoot, 'state', 'implementation-task-graph-history.json');
    const packetsFilePath = path.join(tmpRoot, 'state', 'codex-execution-packets.json');
    const packetHistoryFilePath = path.join(tmpRoot, 'state', 'codex-execution-packet-history.json');
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'codex');

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

    const manager = createCodexExecutionPacketManager({
      packetsFilePath,
      historyFilePath: packetHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
    });

    const created = manager.createCodexExecutionPackets(graph.taskGraphId);
    const packetId = created.packetIds[0]!;
    const before = manager.getCodexExecutionPacket(packetId);

    const materializer = createCodexExecutionPacketMaterializer({
      manager,
      artifactsRoot,
      packetsFilePath,
      historyFilePath: packetHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
    });

    const first = materializer.materializeCodexExecutionPacket(packetId);
    const second = materializer.materializeCodexExecutionPacket(packetId);

    expect(fs.existsSync(first.packetPath)).toBe(true);
    expect(fs.existsSync(first.statusPath)).toBe(true);
    expect(fs.existsSync(first.validationPath)).toBe(true);
    expect(fs.existsSync(first.promptPath)).toBe(true);
    expect(fs.existsSync(first.reportPath)).toBe(true);

    expect(fs.readFileSync(first.packetPath, 'utf8')).toBe(fs.readFileSync(second.packetPath, 'utf8'));
    expect(fs.readFileSync(first.statusPath, 'utf8')).toBe(fs.readFileSync(second.statusPath, 'utf8'));
    expect(fs.readFileSync(first.validationPath, 'utf8')).toBe(fs.readFileSync(second.validationPath, 'utf8'));
    expect(fs.readFileSync(first.promptPath, 'utf8')).toBe(fs.readFileSync(second.promptPath, 'utf8'));
    expect(fs.readFileSync(first.reportPath, 'utf8')).toContain('## Expected Artifacts');
    expect(fs.readFileSync(first.reportPath, 'utf8')).toContain(`- packetId: ${packetId}`);

    const after = manager.getCodexExecutionPacket(packetId);
    expect(after).toEqual(before);
  });
});
