import fs from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createEngineeringPlanManager } from '../../engineering/engineering-plan-manager.ts';
import { EngineeringPlanStatus } from '../../engineering/engineering-plan-status.ts';
import { createEngineeringPlanMaterializer } from '../../engineering/engineering-plan-materializer.ts';

const tmpRoot = path.join('control-plane', '__tests__', 'engineering', 'tmp-engineering-plan-integration');

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('engineering plan integration', () => {
  it('T-PF2-I1 runs create -> validate -> history -> projection -> materialize flow', () => {
    const manager = createEngineeringPlanManager({
      plansFilePath: path.join(tmpRoot, 'state', 'engineering-plans.json'),
      historyFilePath: path.join(tmpRoot, 'state', 'engineering-plan-history.json'),
    });

    const created = manager.createEngineeringPlan({
      specId: 'spec-1',
      architectureSummary: 'Service + worker + queue.',
      subsystems: ['api', 'worker'],
      implementationPhases: ['phase-1', 'phase-2'],
      dependencies: ['db', 'queue'],
      integrationRequirements: ['auth-provider'],
      testStrategy: 'Unit and integration tests',
      constraints: ['deterministic-only'],
    });

    expect(created.status).toBe(EngineeringPlanStatus.DRAFT);

    const validated = manager.validateEngineeringPlan(created.planId);
    expect(validated.status).toBe(EngineeringPlanStatus.VALIDATED);
    expect(validated.historyEvents.some((event) => event.eventType === 'engineering_plan_validated')).toBe(true);

    const projection = manager.deriveEngineeringPlanProjection(created.planId);
    expect(projection.planId).toBe(created.planId);
    expect(projection.validationState).toBe('valid');

    const materializer = createEngineeringPlanMaterializer({
      manager,
      artifactsRoot: path.join(tmpRoot, 'artifacts', 'engineering'),
    });

    const materialized = materializer.materializeEngineeringPlan(created.planId);
    expect(fs.existsSync(materialized.engineeringPlanPath)).toBe(true);
    expect(fs.existsSync(materialized.statusPath)).toBe(true);
    expect(fs.existsSync(materialized.validationPath)).toBe(true);
    expect(fs.existsSync(materialized.reportPath)).toBe(true);
  });
});
