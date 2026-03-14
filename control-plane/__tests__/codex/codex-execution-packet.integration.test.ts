import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createCodexExecutionPacketInspection } from '../../codex/codex-execution-packet-inspection.ts';
import { createCodexExecutionPacketManager } from '../../codex/codex-execution-packet-manager.ts';
import { createEngineeringPlanManager } from '../../engineering/engineering-plan-manager.ts';
import { createImplementationTaskGraphInspection } from '../../tasks/task-graph-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'codex', 'tmp-codex-execution-packet-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('codex execution packet integration', () => {
  it('T-PF4-INT1 creates packets from implementation task graph, validates, inspects, and materializes deterministically', () => {
    const plansFilePath = path.join(tmpRoot, 'state', 'engineering-plans.json');
    const engineeringHistoryFilePath = path.join(tmpRoot, 'state', 'engineering-plan-history.json');
    const taskGraphsFilePath = path.join(tmpRoot, 'state', 'implementation-task-graphs.json');
    const taskGraphHistoryFilePath = path.join(tmpRoot, 'state', 'implementation-task-graph-history.json');
    const packetsFilePath = path.join(tmpRoot, 'state', 'codex-execution-packets.json');
    const packetHistoryFilePath = path.join(tmpRoot, 'state', 'codex-execution-packet-history.json');
    const codexArtifactsRoot = path.join(tmpRoot, 'artifacts', 'codex');

    const engineeringManager = createEngineeringPlanManager({
      plansFilePath,
      historyFilePath: engineeringHistoryFilePath,
    });

    const plan = engineeringManager.createEngineeringPlan({
      specId: 'spec-1',
      architectureSummary: 'API + worker + queue',
      subsystems: ['api', 'worker'],
      implementationPhases: ['phase-1', 'phase-2'],
      dependencies: ['db', 'queue'],
      integrationRequirements: ['auth'],
      testStrategy: 'unit + integration',
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

    const firstCreate = manager.createCodexExecutionPackets(graph.taskGraphId);
    const secondCreate = manager.createCodexExecutionPackets(graph.taskGraphId);

    expect(firstCreate.packetCount).toBe(graph.nodeCount);
    expect(firstCreate.packetIds).toEqual(secondCreate.packetIds);

    const packetId = firstCreate.packetIds[0]!;
    const validation = manager.validateCodexExecutionPacket(packetId);
    expect(['valid', 'incomplete', 'invalid']).toContain(validation.validationState);

    const inspection = createCodexExecutionPacketInspection({
      packetsFilePath,
      historyFilePath: packetHistoryFilePath,
      taskGraphsFilePath,
      taskGraphHistoryFilePath,
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
      artifactsRoot: codexArtifactsRoot,
    });

    const listed = inspection.listCodexExecutionPackets();
    expect(listed).toHaveLength(graph.nodeCount);

    const inspected = inspection.inspectCodexExecutionPacket(packetId);
    expect(inspected.packet.packetId).toBe(packetId);
    expect(inspected.projection.packetId).toBe(packetId);

    const materialized = inspection.materializeCodexExecutionPacket({ packetId });
    expect(fs.existsSync(materialized.packetPath)).toBe(true);
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.validationPath)).toBe(true);
    expect(fs.existsSync(materialized.promptPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);

    const report = fs.readFileSync(materialized.reportPath, 'utf8');
    expect(report).toContain('## Dependencies');
    expect(report).toContain('## Expected Artifacts');
    expect(report).toContain('## Validation Rules');
  });
});
