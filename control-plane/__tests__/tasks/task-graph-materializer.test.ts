import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createEngineeringPlanManager } from '../../engineering/engineering-plan-manager.ts';
import { createImplementationTaskGraphInspection } from '../../tasks/task-graph-inspection.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'tasks', 'tmp-task-graph-materializer');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('implementation task graph materializer', () => {
  it('T-PF3-M1 repeated materialization is deterministic', () => {
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
      implementationPhases: ['phase-1', 'phase-2'],
      dependencies: ['db'],
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

    const created = inspection.createTaskGraph({ planId: plan.planId });

    const first = inspection.materializeTaskGraph({ taskGraphId: created.taskGraphId });
    const second = inspection.materializeTaskGraph({ taskGraphId: created.taskGraphId });

    const firstSnapshot = {
      graph: fs.readFileSync(first.graphPath, 'utf8'),
      status: fs.readFileSync(first.statusPath, 'utf8'),
      history: fs.readFileSync(first.historyPath, 'utf8'),
      report: fs.readFileSync(first.reportPath, 'utf8'),
      nodes: fs.readFileSync(first.nodesPath, 'utf8'),
      edges: fs.readFileSync(first.edgesPath, 'utf8'),
    };

    const secondSnapshot = {
      graph: fs.readFileSync(second.graphPath, 'utf8'),
      status: fs.readFileSync(second.statusPath, 'utf8'),
      history: fs.readFileSync(second.historyPath, 'utf8'),
      report: fs.readFileSync(second.reportPath, 'utf8'),
      nodes: fs.readFileSync(second.nodesPath, 'utf8'),
      edges: fs.readFileSync(second.edgesPath, 'utf8'),
    };

    expect(secondSnapshot).toEqual(firstSnapshot);
    expect(first.graphPath.includes(path.join('artifacts', 'tasks', created.taskGraphId))).toBe(true);
  });
});
