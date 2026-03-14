import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createEngineeringPlanManager } from '../../engineering/engineering-plan-manager.ts';
import { createImplementationTaskGraphInspection } from '../../tasks/task-graph-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tasks', 'tmp-task-graph-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('implementation task graph integration', () => {
  it('T-PF3-I1 creates and materializes graph derived only from EngineeringPlan', () => {
    const plansFilePath = path.join(tmpRoot, 'state', 'engineering-plans.json');
    const engineeringHistoryFilePath = path.join(tmpRoot, 'state', 'engineering-plan-history.json');
    const taskGraphsFilePath = path.join(tmpRoot, 'state', 'implementation-task-graphs.json');
    const taskGraphHistoryFilePath = path.join(tmpRoot, 'state', 'implementation-task-graph-history.json');
    const artifactsRoot = path.join(tmpRoot, 'artifacts', 'tasks');

    const engineeringManager = createEngineeringPlanManager({
      plansFilePath,
      historyFilePath: engineeringHistoryFilePath,
    });

    const plan = engineeringManager.createEngineeringPlan({
      specId: 'spec-1',
      architectureSummary: 'Service + worker + queue',
      subsystems: ['api', 'worker'],
      implementationPhases: ['phase-1', 'phase-2', 'phase-3'],
      dependencies: ['db', 'queue'],
      integrationRequirements: ['auth'],
      testStrategy: 'unit + integration',
      constraints: ['deterministic'],
    });

    const inspection = createImplementationTaskGraphInspection({
      plansFilePath,
      engineeringPlanHistoryFilePath: engineeringHistoryFilePath,
      taskGraphsFilePath,
      historyFilePath: taskGraphHistoryFilePath,
      artifactsRoot,
    });

    const createdFirst = inspection.createTaskGraph({ planId: plan.planId });
    const createdSecond = inspection.createTaskGraph({ planId: plan.planId });

    expect(createdFirst.taskGraphId).toBe(createdSecond.taskGraphId);
    expect(createdFirst.status).toBe('ready');

    const inspected = inspection.inspectTaskGraph({ taskGraphId: createdFirst.taskGraphId });
    expect(inspected.planId).toBe(plan.planId);
    expect(inspected.nodeCount).toBe(3);

    const materialized = inspection.materializeTaskGraph({ taskGraphId: createdFirst.taskGraphId });
    expect(fs.existsSync(materialized.graphPath)).toBe(true);
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.historyPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);
    expect(fs.existsSync(materialized.nodesPath)).toBe(true);
    expect(fs.existsSync(materialized.edgesPath)).toBe(true);

    const postMaterializeProjection = inspection.inspectTaskGraph({ taskGraphId: createdFirst.taskGraphId });
    expect(postMaterializeProjection.status).toBe('materialized');

    expect(fs.existsSync(path.join('control-plane', 'cli', 'task-graph-list.ts'))).toBe(true);
    expect(fs.existsSync(path.join('control-plane', 'task-graph', 'task-graph-inspection.ts'))).toBe(true);
  });
});
